"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
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
  Info
} from "lucide-react"

// Form validation schema based on task requirements
const fruitLoadSchema = z.object({
  purchaseItemId: z.string().uuid("Please select a purchase line"),
  appleVarietyId: z.string().uuid("Please select an apple variety"),
  weight: z.number().min(0.1, "Weight must be at least 0.1").max(10000, "Weight cannot exceed 10,000"),
  weightUnit: z.enum(['lbs', 'kg'], { message: "Please select a weight unit" }),
  brixMeasured: z.number().min(0).max(30).optional(),
  phMeasured: z.number().min(2).max(5).optional(),
  appleCondition: z.enum(['excellent', 'good', 'fair', 'poor']).optional(),
  defectPercentage: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
})

type FruitLoadFormData = z.infer<typeof fruitLoadSchema>

// Mock data - will be replaced with tRPC calls
interface PurchaseLine {
  id: string
  purchaseItemId: string
  appleVarietyId: string
  varietyName: string
  vendorName: string
  availableQuantityKg: number
  originalQuantity: number
  originalUnit: string
  harvestDate?: string
}

interface AppleVariety {
  id: string
  name: string
  typicalBrix?: number
}

interface FruitLoadFormProps {
  loadSequence: number
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

export function FruitLoadForm({
  loadSequence,
  onSubmit,
  onCancel,
  isSubmitting = false
}: FruitLoadFormProps) {
  const [selectedPurchaseLine, setSelectedPurchaseLine] = useState<PurchaseLine | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [weightUnit, setWeightUnit] = useState<'lbs' | 'kg'>('lbs') // Default to lbs as per task requirements

  // Mock data - will be replaced with tRPC queries
  const mockPurchaseLines: PurchaseLine[] = [
    {
      id: "pl-1",
      purchaseItemId: "pi-1",
      appleVarietyId: "av-1",
      varietyName: "Honeycrisp",
      vendorName: "Apple Valley Farm",
      availableQuantityKg: 150.5,
      originalQuantity: 332,
      originalUnit: "lbs"
    },
    {
      id: "pl-2",
      purchaseItemId: "pi-2",
      appleVarietyId: "av-2",
      varietyName: "Gala",
      vendorName: "Apple Valley Farm",
      availableQuantityKg: 200.8,
      originalQuantity: 443,
      originalUnit: "lbs"
    },
    {
      id: "pl-3",
      purchaseItemId: "pi-3",
      appleVarietyId: "av-3",
      varietyName: "Granny Smith",
      vendorName: "Orchard Hills",
      availableQuantityKg: 89.2,
      originalQuantity: 4,
      originalUnit: "bushels"
    }
  ]

  const mockAppleVarieties: AppleVariety[] = [
    { id: "av-1", name: "Honeycrisp", typicalBrix: 14.5 },
    { id: "av-2", name: "Gala", typicalBrix: 13.2 },
    { id: "av-3", name: "Granny Smith", typicalBrix: 11.8 }
  ]

  const form = useForm<FruitLoadFormData>({
    resolver: zodResolver(fruitLoadSchema),
    defaultValues: {
      weightUnit: 'lbs',
      weight: undefined,
      brixMeasured: undefined,
      phMeasured: undefined,
      appleCondition: undefined,
      defectPercentage: undefined,
      notes: ""
    }
  })

  // Watch for weight and unit changes to show real-time conversion
  const watchedWeight = form.watch('weight')
  const watchedUnit = form.watch('weightUnit')

  // Unit conversion helpers
  const convertWeight = (weight: number, fromUnit: 'lbs' | 'kg', toUnit: 'lbs' | 'kg'): number => {
    if (fromUnit === toUnit) return weight
    if (fromUnit === 'lbs' && toUnit === 'kg') return weight * 0.453592
    if (fromUnit === 'kg' && toUnit === 'lbs') return weight * 2.20462
    return weight
  }

  const getConvertedWeight = (): { value: number; unit: 'lbs' | 'kg' } => {
    if (!watchedWeight || !watchedUnit) return { value: 0, unit: 'lbs' }
    // Always show the converted weight in lbs
    return {
      value: convertWeight(watchedWeight, watchedUnit, 'lbs'),
      unit: 'lbs'
    }
  }

  // Filter purchase lines based on search
  const filteredPurchaseLines = mockPurchaseLines.filter(line =>
    line.varietyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    line.vendorName.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleSubmit = (data: FruitLoadFormData) => {
    if (!selectedPurchaseLine) return

    const variety = mockAppleVarieties.find(v => v.id === data.appleVarietyId)
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

  const handlePurchaseLineSelect = (purchaseLineId: string) => {
    const line = mockPurchaseLines.find(l => l.id === purchaseLineId)
    if (line) {
      setSelectedPurchaseLine(line)
      form.setValue('purchaseItemId', line.purchaseItemId)
      form.setValue('appleVarietyId', line.appleVarietyId)

      // Set suggested brix from apple variety
      const variety = mockAppleVarieties.find(v => v.id === line.appleVarietyId)
      if (variety?.typicalBrix) {
        form.setValue('brixMeasured', variety.typicalBrix)
      }
    }
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
              <div className="max-h-48 overflow-y-auto space-y-2 border rounded-lg p-2">
                {filteredPurchaseLines.map((line) => (
                  <button
                    key={line.id}
                    type="button"
                    onClick={() => handlePurchaseLineSelect(line.id)}
                    className={`w-full p-3 text-left rounded-lg border transition-all ${
                      selectedPurchaseLine?.id === line.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium text-gray-900">{line.varietyName}</h4>
                        <p className="text-sm text-gray-600">{line.vendorName}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-green-600">
                          {convertWeight(line.availableQuantityKg, 'kg', 'lbs').toFixed(1)} lbs available
                        </p>
                        <p className="text-xs text-gray-500">
                          ({line.originalQuantity} {line.originalUnit} purchased)
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {selectedPurchaseLine && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800">
                      Selected: {selectedPurchaseLine.varietyName} from {selectedPurchaseLine.vendorName}
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
                            onClick={() => {
                              field.onChange('lbs')
                              setWeightUnit('lbs')
                            }}
                            className={`flex-1 rounded-l-md text-sm font-medium transition-colors ${
                              field.value === 'lbs'
                                ? 'bg-blue-600 text-white'
                                : 'bg-background text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            lbs
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              field.onChange('kg')
                              setWeightUnit('kg')
                            }}
                            className={`flex-1 rounded-r-md text-sm font-medium transition-colors ${
                              field.value === 'kg'
                                ? 'bg-blue-600 text-white'
                                : 'bg-background text-gray-700 hover:bg-gray-50'
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
              {(watchedWeight != null && watchedWeight > 0) && watchedUnit && (
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

              {/* Inventory validation warning */}
              {selectedPurchaseLine && watchedWeight && watchedUnit && (
                <div>
                  {(() => {
                    const weightKg = watchedUnit === 'kg' ? watchedWeight : convertWeight(watchedWeight, 'lbs', 'kg')
                    const available = selectedPurchaseLine.availableQuantityKg

                    if (weightKg > available) {
                      return (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                          <div className="flex items-center space-x-2">
                            <AlertCircle className="w-4 h-4 text-red-600" />
                            <span className="text-sm text-red-800">
                              Insufficient inventory! Available: {available.toFixed(1)} kg
                            </span>
                          </div>
                        </div>
                      )
                    } else if (weightKg > available * 0.8) {
                      return (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                          <div className="flex items-center space-x-2">
                            <Info className="w-4 h-4 text-yellow-600" />
                            <span className="text-sm text-yellow-800">
                              Using {((weightKg / available) * 100).toFixed(0)}% of available inventory
                            </span>
                          </div>
                        </div>
                      )
                    }
                    return null
                  })()}
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
                disabled={isSubmitting || !selectedPurchaseLine}
                className="flex-1 h-12 bg-green-600 hover:bg-green-700"
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