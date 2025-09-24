"use client"

import { useState } from "react"
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
import { Textarea } from "@/components/ui/textarea"
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
  Beaker,
  Calendar,
  Building2,
  Package,
  Info
} from "lucide-react"

// Form validation schema
const additivesTransactionSchema = z.object({
  vendorId: z.string().uuid("Please select a vendor"),
  additiveType: z.enum(['enzyme', 'nutrient', 'clarifier', 'preservative', 'acid', 'other'], {
    message: "Please select an additive type"
  }),
  brandManufacturer: z.string().min(1, "Brand/manufacturer is required"),
  productName: z.string().min(1, "Product name is required"),
  quantity: z.number().min(0.1, "Quantity must be at least 0.1").max(10000, "Quantity cannot exceed 10,000"),
  unit: z.enum(['g', 'kg', 'oz', 'lb'], { message: "Please select a unit" }),
  lotBatchNumber: z.string().optional(),
  expirationDate: z.string().optional(),
  storageRequirements: z.string().optional(),
  unitCost: z.number().min(0, "Unit cost must be positive").optional(),
  totalCost: z.number().min(0, "Total cost must be positive").optional(),
  notes: z.string().optional(),
})

type AdditivesTransactionFormData = z.infer<typeof additivesTransactionSchema>

interface Vendor {
  id: string
  name: string
  contactInfo?: {
    email?: string
    phone?: string
    address?: string
  }
  isActive: boolean
}

const additiveTypeOptions = [
  { value: 'enzyme', label: 'Enzyme', description: 'Pectinase, amylase, etc.' },
  { value: 'nutrient', label: 'Nutrient', description: 'Yeast nutrients, DAP, etc.' },
  { value: 'clarifier', label: 'Clarifier', description: 'Bentonite, isinglass, etc.' },
  { value: 'preservative', label: 'Preservative', description: 'Potassium sorbate, sulfites, etc.' },
  { value: 'acid', label: 'Acid', description: 'Malic acid, tartaric acid, etc.' },
  { value: 'other', label: 'Other', description: 'Other additives' }
]

const unitOptions = [
  { value: 'g', label: 'Grams (g)' },
  { value: 'kg', label: 'Kilograms (kg)' },
  { value: 'oz', label: 'Ounces (oz)' },
  { value: 'lb', label: 'Pounds (lb)' }
]

interface AdditivesTransactionFormProps {
  onSubmit: (transaction: {
    vendorId: string
    additiveType: string
    brandManufacturer: string
    productName: string
    quantity: number
    unit: string
    lotBatchNumber?: string
    expirationDate?: string
    storageRequirements?: string
    unitCost?: number
    totalCost?: number
    notes?: string
  }) => void
  onCancel?: () => void
  isSubmitting?: boolean
}

export function AdditivesTransactionForm({
  onSubmit,
  onCancel,
  isSubmitting = false
}: AdditivesTransactionFormProps) {
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  // Fetch vendors that have additive varieties
  const { data: vendorData, isLoading: vendorsLoading } = trpc.vendor.listByVarietyType.useQuery({
    varietyType: 'additive',
    includeInactive: false
  })
  const vendors = vendorData?.vendors || []

  const form = useForm<AdditivesTransactionFormData>({
    resolver: zodResolver(additivesTransactionSchema),
    defaultValues: {
      unit: 'g',
      quantity: undefined,
      unitCost: undefined,
      totalCost: undefined,
      brandManufacturer: "",
      productName: "",
      lotBatchNumber: "",
      storageRequirements: "",
      notes: ""
    }
  })

  // Watch for quantity and unit cost changes to calculate total
  const watchedQuantity = form.watch('quantity')
  const watchedUnitCost = form.watch('unitCost')

  // Calculate total cost automatically
  const calculateTotalCost = (): number => {
    if (watchedQuantity && watchedUnitCost) {
      return watchedQuantity * watchedUnitCost
    }
    return 0
  }

  // Update total cost when quantity or unit cost changes
  const totalCost = calculateTotalCost()
  if (totalCost > 0 && form.getValues('totalCost') !== totalCost) {
    form.setValue('totalCost', totalCost)
  }

  // Unit conversion helpers for display
  const convertWeight = (weight: number, fromUnit: string, toUnit: string): number => {
    const conversions: { [key: string]: number } = {
      'g': 1,
      'kg': 1000,
      'oz': 28.3495,
      'lb': 453.592
    }

    if (fromUnit === toUnit) return weight
    return (weight * conversions[fromUnit]) / conversions[toUnit]
  }

  // Filter vendors based on search
  const filteredVendors = vendors.filter(vendor =>
    vendor.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleSubmit = (data: AdditivesTransactionFormData) => {
    onSubmit({
      vendorId: data.vendorId,
      additiveType: data.additiveType,
      brandManufacturer: data.brandManufacturer,
      productName: data.productName,
      quantity: data.quantity,
      unit: data.unit,
      lotBatchNumber: data.lotBatchNumber || undefined,
      expirationDate: data.expirationDate || undefined,
      storageRequirements: data.storageRequirements || undefined,
      unitCost: data.unitCost || undefined,
      totalCost: data.totalCost || undefined,
      notes: data.notes || undefined
    })
  }

  const handleVendorSelect = (vendorId: string) => {
    const vendor = vendors.find(v => v.id === vendorId)
    if (vendor) {
      setSelectedVendor(vendor)
      form.setValue('vendorId', vendor.id)
    }
  }

  const selectedAdditiveType = form.watch('additiveType')
  const additiveTypeInfo = additiveTypeOptions.find(opt => opt.value === selectedAdditiveType)

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <div className="bg-purple-100 rounded-full p-2">
            <Beaker className="w-5 h-5 text-purple-600" />
          </div>
          <span>Record Additives Transaction</span>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">

            {/* Vendor Selection */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Select Vendor</Label>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search vendors..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-12"
                />
              </div>

              {/* Vendors List */}
              <div className="max-h-48 overflow-y-auto space-y-2 border rounded-lg p-2">
                {filteredVendors.map((vendor) => (
                  <button
                    key={vendor.id}
                    type="button"
                    onClick={() => handleVendorSelect(vendor.id)}
                    className={`w-full p-3 text-left rounded-lg border transition-all ${
                      selectedVendor?.id === vendor.id
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium text-gray-900">{vendor.name}</h4>
                        <p className="text-sm text-gray-600">{vendor.contactInfo}</p>
                        {vendor.specializesIn && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {vendor.specializesIn.map((spec) => (
                              <Badge key={spec} variant="outline" className="text-xs">
                                {spec}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <Building2 className="w-4 h-4 text-gray-400" />
                    </div>
                  </button>
                ))}
              </div>

              {selectedVendor && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800">
                      Selected: {selectedVendor.name}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Additive Type and Product Details */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <Label className="text-base font-medium">Product Details</Label>

                {/* Additive Type */}
                <FormField
                  control={form.control}
                  name="additiveType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Additive Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-12">
                            <SelectValue placeholder="Select additive type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {additiveTypeOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              <div>
                                <div className="font-medium">{option.label}</div>
                                <div className="text-xs text-gray-500">{option.description}</div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {additiveTypeInfo && (
                        <FormDescription className="text-xs">
                          {additiveTypeInfo.description}
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Brand/Manufacturer */}
                <FormField
                  control={form.control}
                  name="brandManufacturer"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Brand/Manufacturer</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="e.g., Lallemand, BSG, Scott Labs"
                          className="h-12"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Product Name */}
                <FormField
                  control={form.control}
                  name="productName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product Name</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="e.g., Pectinase, Fermaid K, Potassium Sorbate"
                          className="h-12"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4">
                <Label className="text-base font-medium">Quantity & Pricing</Label>

                {/* Quantity and Unit */}
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantity</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Scale className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                              {...field}
                              type="number"
                              step="0.1"
                              placeholder="0.0"
                              className="pl-10 h-12"
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
                    name="unit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-12">
                              <SelectValue placeholder="Unit" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {unitOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Unit Cost and Total Cost */}
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="unitCost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit Cost ($)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            className="h-12"
                            onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="totalCost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Cost ($)</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              {...field}
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              className="h-12"
                              value={totalCost > 0 ? totalCost.toFixed(2) : field.value || ""}
                              onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                            />
                            {totalCost > 0 && (
                              <CheckCircle2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-green-600" />
                            )}
                          </div>
                        </FormControl>
                        <FormDescription className="text-xs">
                          Auto-calculated from quantity × unit cost
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>

            {/* Additional Details */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Additional Details (Optional)</Label>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="lotBatchNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lot/Batch Number</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Package className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <Input
                            {...field}
                            placeholder="e.g., LOT2024-001"
                            className="pl-10 h-12"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="expirationDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expiration Date</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <Input
                            {...field}
                            type="date"
                            className="pl-10 h-12"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="storageRequirements"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Storage Requirements</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g., Store in cool, dry place; Keep refrigerated; Protect from light"
                        className="h-12"
                      />
                    </FormControl>
                    <FormDescription>
                      Specify storage temperature, humidity, light conditions, etc.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Any additional notes about this purchase..."
                        className="min-h-[100px]"
                      />
                    </FormControl>
                    <FormDescription>
                      Add any observations about quality, intended use, supplier notes, etc.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
                disabled={isSubmitting || !selectedVendor}
                className="flex-1 h-12 bg-purple-600 hover:bg-purple-700"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Recording Transaction...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Record Transaction
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