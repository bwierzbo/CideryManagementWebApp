"use client"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  CheckCircle2,
  Droplets,
  Beaker,
  TrendingUp,
  ArrowRight,
  Eye,
  Plus,
  BarChart3,
} from "lucide-react"

interface PressRunCompletionSuccessProps {
  completedPressRun: {
    id: string
    vendorName?: string
    totalJuiceVolumeL: number
    extractionRate: number
    createdBatchIds: string[]
    totalAppleWeightKg?: number
    endTime: string
    laborHours?: number
    laborCost?: number
  }
  onViewJuiceLot?: () => void
  onStartNewRun: () => void
  onViewPressRun: () => void
  onBackToPressingHome: () => void
}

export function PressRunCompletionSuccess({
  completedPressRun,
  onViewJuiceLot,
  onStartNewRun,
  onViewPressRun,
  onBackToPressingHome,
}: PressRunCompletionSuccessProps) {
  const totalJuiceGal = completedPressRun.totalJuiceVolumeL / 3.78541
  const extractionPercentage = completedPressRun.extractionRate * 100

  // Format completion time
  const completionTime = new Date(completedPressRun.endTime).toLocaleString()

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Success Header */}
      <Card className="border-green-200 bg-green-50">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <CardTitle className="text-xl text-green-900">
            Press Run Completed Successfully!
          </CardTitle>
          <CardDescription className="text-green-700">
            Your apples have been pressed and {completedPressRun.createdBatchIds.length} fermentation batch{completedPressRun.createdBatchIds.length === 1 ? '' : 'es'} {completedPressRun.createdBatchIds.length === 1 ? 'has' : 'have'} been created
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Completion Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-lg">
            <BarChart3 className="w-5 h-5 mr-2 text-blue-600" />
            Completion Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <Droplets className="w-6 h-6 text-blue-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-blue-800">
                {completedPressRun.totalJuiceVolumeL.toFixed(0)}L
              </div>
              <div className="text-sm text-blue-600">
                Juice Produced
              </div>
              <div className="text-xs text-blue-500 mt-1">
                {totalJuiceGal.toFixed(1)} gallons
              </div>
            </div>

            <div className="text-center p-4 bg-green-50 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-green-800">
                {extractionPercentage.toFixed(1)}%
              </div>
              <div className="text-sm text-green-600">
                Extraction Rate
              </div>
              {completedPressRun.totalAppleWeightKg && (
                <div className="text-xs text-green-500 mt-1">
                  from {completedPressRun.totalAppleWeightKg}kg apples
                </div>
              )}
            </div>

            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <Beaker className="w-6 h-6 text-purple-600 mx-auto mb-2" />
              <div className="text-sm font-medium text-purple-800 mb-1">
                Batches Created
              </div>
              <div className="text-lg font-bold text-purple-800">
                {completedPressRun.createdBatchIds.length}
              </div>
              <Badge variant="outline" className="mt-1 text-xs">
                Ready for Fermentation
              </Badge>
            </div>
          </div>

          <Separator />

          {/* Additional Details */}
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-gray-600">Press Run ID:</span>
              <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                {completedPressRun.id}
              </span>
            </div>

            {completedPressRun.vendorName && (
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-gray-600">Vendor:</span>
                <span className="font-medium text-sm">{completedPressRun.vendorName}</span>
              </div>
            )}

            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-gray-600">Completed:</span>
              <span className="text-sm">{completionTime}</span>
            </div>

            {completedPressRun.laborHours && (
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-gray-600">Labor Hours:</span>
                <span className="text-sm">
                  {completedPressRun.laborHours.toFixed(1)} hours
                  {completedPressRun.laborCost && (
                    <span className="text-gray-500 ml-2">
                      (${completedPressRun.laborCost.toFixed(2)})
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>

          {/* Created Batches */}
          <Separator />
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-900">Created Batches</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {completedPressRun.createdBatchIds.map((batchId, index) => (
                <div key={batchId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="text-sm font-medium">Batch {index + 1}</div>
                    <div className="text-xs text-gray-600 font-mono">{batchId}</div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.location.href = `/batches/${batchId}`}
                    className="text-xs"
                  >
                    <Eye className="w-3 h-3 mr-1" />
                    View
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Performance Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Extraction Rate Assessment */}
            <div className="p-3 rounded-lg bg-gradient-to-r from-blue-50 to-green-50">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-gray-900 mb-1">
                    Extraction Efficiency
                  </h4>
                  <p className="text-sm text-gray-600">
                    {extractionPercentage >= 70 && (
                      <span className="text-green-700">
                        🎉 Excellent extraction rate! You achieved {extractionPercentage.toFixed(1)}% efficiency.
                      </span>
                    )}
                    {extractionPercentage >= 60 && extractionPercentage < 70 && (
                      <span className="text-blue-700">
                        👍 Good extraction rate of {extractionPercentage.toFixed(1)}%. This is within normal range.
                      </span>
                    )}
                    {extractionPercentage < 60 && (
                      <span className="text-amber-700">
                        ⚠️ Lower extraction rate of {extractionPercentage.toFixed(1)}%. Consider checking apple quality or pressing technique.
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Next Steps */}
            <div className="p-3 rounded-lg bg-amber-50">
              <h4 className="text-sm font-medium text-amber-900 mb-1">
                Next Steps
              </h4>
              <p className="text-sm text-amber-700">
                Your juice is now ready for fermentation. Consider taking initial measurements (Brix, pH) and adding yeast when ready to begin fermentation.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="space-y-3">
        {/* Primary Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Button
            onClick={() => window.location.href = '/batches'}
            className="h-12 bg-blue-600 hover:bg-blue-700"
          >
            <Beaker className="w-5 h-5 mr-2" />
            View All Batches
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          <Button
            onClick={onStartNewRun}
            className="h-12 bg-green-600 hover:bg-green-700"
          >
            <Plus className="w-5 h-5 mr-2" />
            Start New Press Run
          </Button>
        </div>

        {/* Secondary Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Button
            onClick={onViewPressRun}
            variant="outline"
            className="h-10"
          >
            <Eye className="w-4 h-4 mr-2" />
            View Press Run Details
          </Button>
          <Button
            onClick={onBackToPressingHome}
            variant="outline"
            className="h-10"
          >
            Back to Pressing Home
          </Button>
        </div>
      </div>

      {/* Mobile Optimizations */}
      <div className="md:hidden">
        <div className="text-center py-4 text-xs text-gray-500">
          Tap any action above to continue your workflow
        </div>
      </div>
    </div>
  )
}