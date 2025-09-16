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
  Info,
  RefreshCw,
  Building2,
  Trash2
} from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

// Form validation schema
const fruitLoadSchema = z.object({
  vendorId: z.string().uuid("Please select a vendor"),
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

interface FruitLoadFormWithTRPCProps {
  loadSequence: number
  vendorId?: string
  editingLoad?: any // The load being edited (if in edit mode)
  onSubmit: (load: {
    loadSequence: number
    vendorId: string
    purchaseItemId: string
    appleVarietyId: string
    appleVarietyName: string
    appleWeightKg: number
    originalWeight: number
    originalWeightUnit: 'kg' | 'lb' | 'bushel'
    brixMeasured?: number
    phMeasured?: number
    appleCondition?: string
    defectPercentage?: number
    notes?: string
  }) => void
  onCancel?: () => void
  onDelete?: (loadId: string) => void // Optional delete callback
  isSubmitting?: boolean
}

export function FruitLoadFormWithTRPC({
  loadSequence,
  vendorId,
  editingLoad,
  onSubmit,
  onCancel,
  onDelete,
  isSubmitting = false
}: FruitLoadFormWithTRPCProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedPurchaseItem, setSelectedPurchaseItem] = useState<any>(null)
  const [requestedWeightKg, setRequestedWeightKg] = useState<number>(0)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  // tRPC queries
  const {
    data: vendors,
    isLoading: vendorsLoading
  } = trpc.vendor.list.useQuery()

  const {
    data: appleVarieties,
    isLoading: varietiesLoading
  } = trpc.appleVariety.listAll.useQuery({ includeInactive: false })

  // Availability validation query
  // Note: Removed availability validation - purchase weights are estimates only

  // Determine if we're in edit mode and set appropriate defaults
  const isEditMode = !!editingLoad

  const form = useForm<FruitLoadFormData>({
    resolver: zodResolver(fruitLoadSchema),
    defaultValues: {
      vendorId: editingLoad?.vendorId || vendorId || "",
      purchaseItemId: editingLoad?.purchaseItemId || "",
      appleVarietyId: editingLoad?.appleVarietyId || "",
      weightUnit: editingLoad?.originalWeightUnit === 'lb' ? 'lbs' : (editingLoad?.originalWeightUnit || 'lbs'),
      weight: editingLoad ? parseFloat(editingLoad.originalWeight || '1') : 1,
      brixMeasured: editingLoad?.brixMeasured ? parseFloat(editingLoad.brixMeasured) : undefined,
      phMeasured: editingLoad?.phMeasured ? parseFloat(editingLoad.phMeasured) : undefined,
      appleCondition: editingLoad?.appleCondition || undefined,
      defectPercentage: editingLoad?.defectPercentage ? parseFloat(editingLoad.defectPercentage) : undefined,
      notes: editingLoad?.notes || ""
    }
  })

  // Watch for form changes
  const watchedVendorId = form.watch('vendorId')
  const watchedWeight = form.watch('weight')
  const watchedUnit = form.watch('weightUnit')

  // Purchase lines query - depends on vendor selection
  const {
    data: purchaseLines,
    isLoading: purchaseLinesLoading,
    error: purchaseLinesError,
    refetch: refetchPurchaseLines
  } = trpc.purchaseLine.available.useQuery({
    vendorId: watchedVendorId || vendorId,
    limit: 50,
    offset: 0
  }, {
    enabled: !!(watchedVendorId || vendorId)
  })

  // Update requested weight for availability checking
  useEffect(() => {
    if (watchedWeight && watchedUnit) {
      const weightKg = watchedUnit === 'kg' ? watchedWeight : convertWeight(watchedWeight, 'lbs', 'kg')
      setRequestedWeightKg(weightKg)
    }
  }, [watchedWeight, watchedUnit])

  // Reset form values when editingLoad changes
  useEffect(() => {
    if (editingLoad) {
      form.reset({
        vendorId: editingLoad.vendorId || "",
        purchaseItemId: editingLoad.purchaseItemId || "",
        appleVarietyId: editingLoad.appleVarietyId || "",
        weightUnit: editingLoad.originalWeightUnit === 'lb' ? 'lbs' : (editingLoad.originalWeightUnit || 'lbs'),
        weight: editingLoad ? parseFloat(editingLoad.originalWeight || '0') : undefined,
        brixMeasured: editingLoad.brixMeasured ? parseFloat(editingLoad.brixMeasured) : undefined,
        phMeasured: editingLoad.phMeasured ? parseFloat(editingLoad.phMeasured) : undefined,
        appleCondition: editingLoad.appleCondition || undefined,
        defectPercentage: editingLoad.defectPercentage ? parseFloat(editingLoad.defectPercentage) : undefined,
        notes: editingLoad.notes || ""
      })
    }
  }, [editingLoad, form])

  // Set initial selected purchase item for edit mode
  useEffect(() => {
    if (editingLoad && purchaseLines?.items) {
      const purchaseItem = purchaseLines.items.find(item => item.purchaseItemId === editingLoad.purchaseItemId)
      if (purchaseItem) {
        setSelectedPurchaseItem(purchaseItem)
      }
    }
  }, [editingLoad, purchaseLines])

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
    if (!selectedPurchaseItem || !appleVarieties) {
      return
    }

    const variety = appleVarieties?.appleVarieties.find(v => v.id === data.appleVarietyId)
    const weightKg = data.weightUnit === 'kg' ? data.weight : convertWeight(data.weight, 'lbs', 'kg')

    // Convert weight unit to match database enum
    let originalWeightUnit: 'kg' | 'lb' | 'bushel' = 'kg'
    if (data.weightUnit === 'lbs') originalWeightUnit = 'lb'

    const submitData = {
      loadSequence,
      vendorId: data.vendorId,
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
    }

    onSubmit(submitData)
  }

  const handlePurchaseLineSelect = (purchaseLineItem: any) => {
    setSelectedPurchaseItem(purchaseLineItem)
    form.setValue('purchaseItemId', purchaseLineItem.purchaseItemId)
    form.setValue('appleVarietyId', purchaseLineItem.appleVarietyId)
  }

  const handleDeleteClick = () => {
    setShowDeleteDialog(true)
  }

  const handleConfirmDelete = () => {
    if (onDelete && editingLoad?.id) {
      onDelete(editingLoad.id)
    }
    setShowDeleteDialog(false)
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
          <div className={`rounded-full p-2 ${isEditMode ? 'bg-blue-100' : 'bg-blue-100'}`}>
            <Apple className={`w-5 h-5 ${isEditMode ? 'text-blue-600' : 'text-blue-600'}`} />
          </div>
          <span>{isEditMode ? `Edit Fruit Load #${loadSequence}` : `Add Fruit Load #${loadSequence}`}</span>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">

            {/* Vendor Selection */}
            <FormField
              control={form.control}
              name="vendorId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-medium flex items-center">
                    <Building2 className="w-4 h-4 mr-2" />
                    Select Vendor
                  </FormLabel>
                  <FormControl>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={vendorsLoading}
                    >
                      <SelectTrigger className="h-12">
                        <SelectValue placeholder={vendorsLoading ? "Loading vendors..." : "Choose a vendor..."} />
                      </SelectTrigger>
                      <SelectContent>
                        {vendors?.vendors?.map((vendor) => (
                          <SelectItem key={vendor.id} value={vendor.id}>
                            {vendor.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormDescription>
                    Select the vendor supplying this apple load
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Purchase Line Selection - Only show when vendor is selected */}
            {watchedVendorId && (
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
            )}

            {/* Weight Input with Unit Toggle - Only show when purchase line is selected */}
            {selectedPurchaseItem && (
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
                            value={field.value || ""}
                            onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : 1)}
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
              {watchedWeight && watchedWeight > 0 && watchedUnit && (
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

              {/* Purchase quantity reference (informational only) */}
              {selectedPurchaseItem && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center space-x-2">
                    <Info className="w-4 h-4 text-blue-600" />
                    <span className="text-sm text-blue-800">
                      Purchase estimate: {parseFloat(selectedPurchaseItem.quantityKg || '0').toFixed(1)} kg
                      <span className="text-blue-600 ml-1">(actual pressing weight may vary)</span>
                    </span>
                  </div>
                </div>
              )}
            </div>
            )}

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

              {/* Delete button - only show in edit mode */}
              {isEditMode && onDelete && editingLoad?.id && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDeleteClick}
                  className="h-12 px-4"
                  disabled={isSubmitting}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              )}

              <Button
                type="submit"
                disabled={
                  isSubmitting ||
                  !selectedPurchaseItem ||
                  !form.formState.isValid
                }
                className="flex-1 h-12 bg-green-600 hover:bg-green-700 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {isEditMode ? 'Updating Load...' : 'Adding Load...'}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    {isEditMode ? `Update Load #${loadSequence}` : `Add Load #${loadSequence}`}
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Load"
        description={`Are you sure you want to delete Load #${editingLoad?.loadSequence || ''}? This action cannot be undone.`}
        confirmText="Yes, Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={handleConfirmDelete}
      />
    </Card>
  )
}