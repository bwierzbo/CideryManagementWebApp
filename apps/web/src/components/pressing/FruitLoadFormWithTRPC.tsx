"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { trpc } from "@/utils/trpc"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form"
import {
  Scale,
  ArrowLeftRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Search,
  Apple,
  Beaker,
  Info,
  RefreshCw
} from "lucide-react"

// Form validation schema
const fruitLoadSchema = z.object({
  purchaseItemId: z.string().uuid("Please select a purchase line"),
  appleVarietyId: z.string().uuid("Please select an apple variety"),
  weight: z.number().min(0.1, "Weight must be at least 0.1").max(10000, "Weight cannot exceed 10,000"),
  weightUnit: z.enum(['lbs', 'kg'], { required_error: "Please select a weight unit" }),
  brixMeasured: z.number().min(0).max(30).optional(),
  phMeasured: z.number().min(2).max(5).optional(),
  appleCondition: z.enum(['excellent', 'good', 'fair', 'poor']).optional(),
  defectPercentage: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
})

type FruitLoadFormData = z.infer<typeof fruitLoadSchema>

interface FruitLoadFormWithTRPCProps {
  loadSequence: number
  vendorId?: string
  onSubmit: (load: {
    loadSequence: number
    purchaseItemId: string
    appleVarietyId: string
    appleVarietyName: string
    appleWeightKg: number
    originalWeight: number
    originalWeightUnit: 'kg' | 'lb' | 'bushel'
    brixMeasured?: number
    phMeasured?: number
    appleCondition?: 'excellent' | 'good' | 'fair' | 'poor'
    defectPercentage?: number
    notes?: string
  }) => void
  onCancel?: () => void
  isSubmitting?: boolean
}

export function FruitLoadFormWithTRPC({
  loadSequence,
  vendorId,
  onSubmit,
  onCancel,
  isSubmitting = false
}: FruitLoadFormWithTRPCProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedPurchaseItem, setSelectedPurchaseItem] = useState<any>(null)
  const [requestedWeightKg, setRequestedWeightKg] = useState<number>(0)

  // tRPC queries
  const {
    data: purchaseLines,
    isLoading: purchaseLinesLoading,
    error: purchaseLinesError,
    refetch: refetchPurchaseLines
  } = trpc.purchaseLine.available.useQuery({
    vendorId,
    limit: 50,
    offset: 0
  })

  const {
    data: appleVarieties,
    isLoading: varietiesLoading
  } = trpc.appleVariety.list.useQuery()

  // Availability validation query
  const {
    data: availabilityCheck,
    isLoading: availabilityLoading,
    error: availabilityError
  } = trpc.purchaseLine.validateAvailability.useQuery(
    {
      purchaseItemId: selectedPurchaseItem?.purchaseItemId || "",
      requestedQuantityKg: requestedWeightKg
    },
    {
      enabled: !!selectedPurchaseItem && requestedWeightKg > 0,
    }
  )

  const form = useForm<FruitLoadFormData>({
    resolver: zodResolver(fruitLoadSchema),
    defaultValues: {
      weightUnit: 'lbs', // Default to lbs as per task requirements
      weight: undefined,
      brixMeasured: undefined,
      phMeasured: undefined,
      appleCondition: undefined,
      defectPercentage: undefined,
      notes: ""
    }
  })

  // Watch for weight and unit changes
  const watchedWeight = form.watch('weight')
  const watchedUnit = form.watch('weightUnit')

  // Update requested weight for availability checking
  useEffect(() => {
    if (watchedWeight && watchedUnit) {
      const weightKg = watchedUnit === 'kg' ? watchedWeight : convertWeight(watchedWeight, 'lbs', 'kg')
      setRequestedWeightKg(weightKg)
    }
  }, [watchedWeight, watchedUnit])

  // Unit conversion helpers
  const convertWeight = (weight: number, fromUnit: 'lbs' | 'kg', toUnit: 'lbs' | 'kg'): number => {
    if (fromUnit === toUnit) return weight
    if (fromUnit === 'lbs' && toUnit === 'kg') return weight * 0.453592
    if (fromUnit === 'kg' && toUnit === 'lbs') return weight * 2.20462
    return weight
  }

  const getConvertedWeight = (): { value: number; unit: 'lbs' | 'kg' } => {
    if (!watchedWeight || !watchedUnit) return { value: 0, unit: 'kg' }
    const oppositeUnit = watchedUnit === 'lbs' ? 'kg' : 'lbs'
    return {
      value: convertWeight(watchedWeight, watchedUnit, oppositeUnit),
      unit: oppositeUnit
    }
  }

  // Filter purchase lines based on search
  const filteredPurchaseLines = purchaseLines?.items.filter(line =>
    line.varietyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    line.vendorName?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || []

  const handleSubmit = (data: FruitLoadFormData) => {
    if (!selectedPurchaseItem || !appleVarieties) return

    const variety = appleVarieties.appleVarieties.find(v => v.id === data.appleVarietyId)
    const weightKg = data.weightUnit === 'kg' ? data.weight : convertWeight(data.weight, 'lbs', 'kg')

    // Convert weight unit to match database enum
    let originalWeightUnit: 'kg' | 'lb' | 'bushel' = 'kg'
    if (data.weightUnit === 'lbs') originalWeightUnit = 'lb'

    onSubmit({
      loadSequence,
      purchaseItemId: data.purchaseItemId,
      appleVarietyId: data.appleVarietyId,
      appleVarietyName: variety?.name || 'Unknown',
      appleWeightKg: weightKg,
      originalWeight: data.weight,
      originalWeightUnit,
      brixMeasured: data.brixMeasured,
      phMeasured: data.phMeasured,
      appleCondition: data.appleCondition,
      defectPercentage: data.defectPercentage,
      notes: data.notes || undefined
    })
  }

  const handlePurchaseLineSelect = (purchaseLineItem: any) => {
    setSelectedPurchaseItem(purchaseLineItem)
    form.setValue('purchaseItemId', purchaseLineItem.purchaseItemId)
    form.setValue('appleVarietyId', purchaseLineItem.appleVarietyId)

    // Set suggested brix from apple variety
    if (appleVarieties) {
      const variety = appleVarieties.appleVarieties.find(v => v.id === purchaseLineItem.appleVarietyId)
      if (variety?.typicalBrix) {
        form.setValue('brixMeasured', parseFloat(variety.typicalBrix))
      }
    }
  }

  // Show loading state
  if (purchaseLinesLoading || varietiesLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-2">Loading purchase lines...</span>
      </div>
    )
  }

  // Show error state
  if (purchaseLinesError) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Data</h3>
          <p className="text-gray-600 mb-4">{purchaseLinesError.message}</p>
          <Button onClick={() => refetchPurchaseLines()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <div className="bg-blue-100 rounded-full p-2">
            <Apple className="w-5 h-5 text-blue-600" />
          </div>
          <span>Add Fruit Load #{loadSequence}</span>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">

            {/* Purchase Line Selection */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Select Purchase Line</Label>

              {/* Purchase Lines Summary */}
              {purchaseLines?.summary && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-blue-800">
                      {purchaseLines.summary.totalAvailableItems} available purchase lines
                    </span>
                    <span className="text-blue-800 font-medium">
                      {purchaseLines.summary.totalAvailableKg.toFixed(1)} kg total
                    </span>
                  </div>
                </div>
              )}

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search by variety or vendor..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-12"
                />
              </div>

              {/* Purchase Lines List */}
              <div className="max-h-60 overflow-y-auto space-y-2 border rounded-lg p-2">
                {filteredPurchaseLines.length > 0 ? (
                  filteredPurchaseLines.map((line) => (
                    <button
                      key={line.purchaseItemId}
                      type="button"
                      onClick={() => handlePurchaseLineSelect(line)}
                      className={`w-full p-4 text-left rounded-lg border transition-all touch-manipulation min-h-[44px] ${
                        selectedPurchaseItem?.purchaseItemId === line.purchaseItemId
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium text-gray-900">{line.varietyName}</h4>
                          <p className="text-sm text-gray-600">{line.vendorName}</p>
                          <p className="text-xs text-gray-500">
                            {line.originalQuantity} {line.originalUnit} purchased
                            {line.harvestDate && ` • Harvested ${line.harvestDate}`}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-green-600">
                            {line.availableQuantityKg.toFixed(1)} kg
                          </p>
                          <p className="text-xs text-gray-500">
                            {line.availablePercentage.toFixed(0)}% available
                          </p>
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <Search className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-600">
                      {searchQuery ? 'No purchase lines match your search' : 'No available purchase lines'}
                    </p>
                  </div>
                )}
              </div>

              {selectedPurchaseItem && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800">
                      Selected: {selectedPurchaseItem.varietyName} from {selectedPurchaseItem.vendorName}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Weight Input with Unit Toggle */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Apple Weight</Label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Weight Input */}
                <FormField
                  control={form.control}
                  name="weight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Weight</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Scale className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <Input
                            {...field}
                            type="number"
                            step="0.1"
                            placeholder="0.0"
                            className="pl-10 h-12 text-lg"
                            onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Unit Toggle */}
                <FormField
                  control={form.control}
                  name="weightUnit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit</FormLabel>
                      <FormControl>
                        <div className="flex h-12 rounded-md border border-input bg-background">
                          <button
                            type="button"
                            onClick={() => field.onChange('lbs')}
                            className={`flex-1 rounded-l-md text-sm font-medium transition-colors touch-manipulation min-h-[44px] ${
                              field.value === 'lbs'
                                ? 'bg-blue-600 text-white'
                                : 'bg-background text-gray-700 hover:bg-gray-50 active:bg-gray-100'
                            }`}
                          >
                            lbs
                          </button>
                          <button
                            type="button"
                            onClick={() => field.onChange('kg')}
                            className={`flex-1 rounded-r-md text-sm font-medium transition-colors touch-manipulation min-h-[44px] ${
                              field.value === 'kg'
                                ? 'bg-blue-600 text-white'
                                : 'bg-background text-gray-700 hover:bg-gray-50 active:bg-gray-100'
                            }`}
                          >
                            kg
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Real-time unit conversion display */}
              {watchedWeight && watchedUnit && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center justify-center space-x-3">
                    <span className="text-sm text-blue-800">
                      {watchedWeight} {watchedUnit}
                    </span>
                    <ArrowLeftRight className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">
                      {getConvertedWeight().value.toFixed(1)} {getConvertedWeight().unit}
                    </span>
                  </div>
                </div>
              )}

              {/* Real-time inventory validation */}
              {availabilityLoading && selectedPurchaseItem && requestedWeightKg > 0 && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center space-x-2">
                    <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
                    <span className="text-sm text-gray-800">
                      Checking inventory availability...
                    </span>
                  </div>
                </div>
              )}

              {availabilityCheck && !availabilityLoading && (
                <div>
                  {!availabilityCheck.isAvailable ? (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <div className="flex items-center space-x-2">
                        <AlertCircle className="w-4 h-4 text-red-600" />
                        <div className="text-sm text-red-800">
                          <p className="font-medium">Insufficient inventory!</p>
                          <p>
                            Available: {availabilityCheck.availableQuantityKg.toFixed(1)} kg
                            {availabilityCheck.shortfallKg > 0 && (
                              <> • Shortfall: {availabilityCheck.shortfallKg.toFixed(1)} kg</>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : availabilityCheck.requestedQuantityKg > availabilityCheck.availableQuantityKg * 0.8 ? (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <div className="flex items-center space-x-2">
                        <Info className="w-4 h-4 text-yellow-600" />
                        <span className="text-sm text-yellow-800">
                          Using {((availabilityCheck.requestedQuantityKg / availabilityCheck.availableQuantityKg) * 100).toFixed(0)}% of available inventory
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <span className="text-sm text-green-800">
                          Inventory available ({availabilityCheck.availableQuantityKg.toFixed(1)} kg total)
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {availabilityError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    <span className="text-sm text-red-800">
                      Error checking availability: {availabilityError.message}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Quality Measurements */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Quality Measurements (Optional)</Label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="brixMeasured"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Brix (°)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Beaker className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <Input
                            {...field}
                            type="number"
                            step="0.1"
                            min="0"
                            max="30"
                            placeholder="0.0"
                            className="pl-10"
                            onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phMeasured"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>pH</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          step="0.1"
                          min="2"
                          max="5"
                          placeholder="3.5"
                          onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="appleCondition"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Apple Condition</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select condition" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="excellent">Excellent</SelectItem>
                          <SelectItem value="good">Good</SelectItem>
                          <SelectItem value="fair">Fair</SelectItem>
                          <SelectItem value="poor">Poor</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="defectPercentage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Defect %</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          placeholder="0"
                          onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Any additional notes about this load..."
                      className="h-12"
                    />
                  </FormControl>
                  <FormDescription>
                    Add any observations about fruit quality, pressing conditions, etc.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Submit Buttons */}
            <div className="flex space-x-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                className="flex-1 h-12"
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  isSubmitting ||
                  !selectedPurchaseItem ||
                  (availabilityCheck && !availabilityCheck.isAvailable)
                }
                className="flex-1 h-12 bg-green-600 hover:bg-green-700 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Adding Load...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Add Load #{loadSequence}
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}