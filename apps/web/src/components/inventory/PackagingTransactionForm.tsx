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
  Package,
  Calendar,
  Building2,
  Hash,
  Clock,
  FileText,
  Info
} from "lucide-react"

// Form validation schema with packaging-specific rules
const packagingTransactionSchema = z.object({
  vendorId: z.string().uuid("Please select a vendor"),
  packageType: z.enum(['bottles', 'cans', 'kegs', 'cases', 'caps', 'labels', 'corks', 'other'], {
    message: "Please select a package type"
  }),
  sizeSpecification: z.string().min(1, "Size/specification is required"),
  productDescription: z.string().min(1, "Product description is required"),
  quantity: z.number().min(1, "Quantity must be at least 1").max(100000, "Quantity cannot exceed 100,000"),
  unitType: z.enum(['cases', 'boxes', 'individual', 'pallets'], { message: "Please select a unit type" }),
  quantityPerUnit: z.number().min(1, "Quantity per unit must be at least 1").max(10000, "Quantity per unit cannot exceed 10,000").optional(),
  skuProductCode: z.string().optional(),
  leadTimeDays: z.number().min(0, "Lead time cannot be negative").max(365, "Lead time cannot exceed 365 days").optional(),
  minimumOrderQuantity: z.number().min(1, "Minimum order quantity must be at least 1").optional(),
  unitCost: z.number().min(0, "Unit cost must be positive").optional(),
  totalCost: z.number().min(0, "Total cost must be positive").optional(),
  materialNotes: z.string().optional(),
})

type PackagingTransactionFormData = z.infer<typeof packagingTransactionSchema>

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

const packageTypeOptions = [
  { value: 'bottles', label: 'Bottles', description: '750ml, 500ml, etc.' },
  { value: 'cans', label: 'Cans', description: '12oz, 16oz aluminum cans' },
  { value: 'kegs', label: 'Kegs', description: '1/6 bbl, 1/2 bbl, etc.' },
  { value: 'cases', label: 'Cases', description: 'Cardboard shipping cases' },
  { value: 'caps', label: 'Caps', description: 'Crown caps, screw caps' },
  { value: 'labels', label: 'Labels', description: 'Product labels, stickers' },
  { value: 'corks', label: 'Corks', description: 'Natural or synthetic corks' },
  { value: 'other', label: 'Other', description: 'Other packaging materials' }
]

const unitTypeOptions = [
  { value: 'cases', label: 'Cases' },
  { value: 'boxes', label: 'Boxes' },
  { value: 'individual', label: 'Individual' },
  { value: 'pallets', label: 'Pallets' }
]

interface PackagingTransactionFormProps {
  onSubmit: (transaction: {
    vendorId: string
    packageType: string
    sizeSpecification: string
    productDescription: string
    quantity: number
    unitType: string
    quantityPerUnit?: number
    skuProductCode?: string
    leadTimeDays?: number
    minimumOrderQuantity?: number
    unitCost?: number
    totalCost?: number
    materialNotes?: string
  }) => void
  onCancel?: () => void
  isSubmitting?: boolean
}

export function PackagingTransactionForm({
  onSubmit,
  onCancel,
  isSubmitting = false
}: PackagingTransactionFormProps) {
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  // Fetch vendors that have packaging varieties
  const { data: vendorData, isLoading: vendorsLoading } = trpc.vendor.listByVarietyType.useQuery({
    varietyType: 'packaging',
    includeInactive: false
  })
  const vendors = vendorData?.vendors || []

  const form = useForm<PackagingTransactionFormData>({
    resolver: zodResolver(packagingTransactionSchema),
    defaultValues: {
      unitType: 'cases',
      quantity: undefined,
      quantityPerUnit: undefined,
      unitCost: undefined,
      totalCost: undefined,
      sizeSpecification: "",
      productDescription: "",
      skuProductCode: "",
      materialNotes: "",
      leadTimeDays: undefined,
      minimumOrderQuantity: undefined,
    }
  })

  // Watch for quantity and unit cost changes to calculate total
  const watchedQuantity = form.watch('quantity')
  const watchedUnitCost = form.watch('unitCost')
  const watchedQuantityPerUnit = form.watch('quantityPerUnit')

  // Calculate total cost automatically
  const calculateTotalCost = (): number => {
    if (watchedQuantity && watchedUnitCost) {
      return watchedQuantity * watchedUnitCost
    }
    return 0
  }

  // Calculate total individual units
  const calculateTotalUnits = (): number => {
    if (watchedQuantity && watchedQuantityPerUnit) {
      return watchedQuantity * watchedQuantityPerUnit
    }
    return watchedQuantity || 0
  }

  // Update total cost when quantity or unit cost changes
  const totalCost = calculateTotalCost()
  if (totalCost > 0 && form.getValues('totalCost') !== totalCost) {
    form.setValue('totalCost', totalCost)
  }

  // Filter vendors based on search
  const filteredVendors = vendors.filter(vendor =>
    vendor.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleSubmit = (data: PackagingTransactionFormData) => {
    onSubmit({
      vendorId: data.vendorId,
      packageType: data.packageType,
      sizeSpecification: data.sizeSpecification,
      productDescription: data.productDescription,
      quantity: data.quantity,
      unitType: data.unitType,
      quantityPerUnit: data.quantityPerUnit || undefined,
      skuProductCode: data.skuProductCode || undefined,
      leadTimeDays: data.leadTimeDays || undefined,
      minimumOrderQuantity: data.minimumOrderQuantity || undefined,
      unitCost: data.unitCost || undefined,
      totalCost: data.totalCost || undefined,
      materialNotes: data.materialNotes || undefined
    })
  }

  const handleVendorSelect = (vendorId: string) => {
    const vendor = vendors.find(v => v.id === vendorId)
    if (vendor) {
      setSelectedVendor(vendor)
      form.setValue('vendorId', vendor.id)
    }
  }

  const selectedPackageType = form.watch('packageType')
  const packageTypeInfo = packageTypeOptions.find(opt => opt.value === selectedPackageType)
  const totalUnits = calculateTotalUnits()

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <div className="bg-amber-100 rounded-full p-2">
            <Package className="w-5 h-5 text-amber-600" />
          </div>
          <span>Record Packaging Transaction</span>
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
                        ? 'border-amber-500 bg-amber-50'
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

            {/* Package Type and Product Details */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <Label className="text-base font-medium">Product Details</Label>

                {/* Package Type */}
                <FormField
                  control={form.control}
                  name="packageType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Package Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-12">
                            <SelectValue placeholder="Select package type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {packageTypeOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              <div>
                                <div className="font-medium">{option.label}</div>
                                <div className="text-xs text-gray-500">{option.description}</div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {packageTypeInfo && (
                        <FormDescription className="text-xs">
                          {packageTypeInfo.description}
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Size/Specification */}
                <FormField
                  control={form.control}
                  name="sizeSpecification"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Size/Specification</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="e.g., 750ml, 12oz, 500ml, 1/6 bbl"
                          className="h-12"
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        Specify size, volume, dimensions, or technical specifications
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Product Description */}
                <FormField
                  control={form.control}
                  name="productDescription"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product Description</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="e.g., Clear glass bottles, Antique brown bottles"
                          className="h-12"
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        Describe color, material, style, or other product details
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* SKU/Product Code */}
                <FormField
                  control={form.control}
                  name="skuProductCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SKU/Product Code</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <Input
                            {...field}
                            placeholder="e.g., BTL-750-CLR, CAP-26MM-BLK"
                            className="pl-10 h-12"
                          />
                        </div>
                      </FormControl>
                      <FormDescription className="text-xs">
                        Vendor SKU or product code for easy reordering
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4">
                <Label className="text-base font-medium">Quantity & Pricing</Label>

                {/* Quantity and Unit Type */}
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
                              step="1"
                              placeholder="0"
                              className="pl-10 h-12"
                              onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="unitType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-12">
                              <SelectValue placeholder="Unit" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {unitTypeOptions.map((option) => (
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

                {/* Quantity Per Unit */}
                <FormField
                  control={form.control}
                  name="quantityPerUnit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantity Per Unit</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Package className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <Input
                            {...field}
                            type="number"
                            step="1"
                            placeholder="e.g., 12, 24, 1000"
                            className="pl-10 h-12"
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                          />
                          {totalUnits > watchedQuantity && (
                            <CheckCircle2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-green-600" />
                          )}
                        </div>
                      </FormControl>
                      <FormDescription className="text-xs">
                        {totalUnits > 0 && watchedQuantityPerUnit ?
                          `Total individual units: ${totalUnits.toLocaleString()}` :
                          "How many individual items per case/box/pallet"
                        }
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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

            {/* Supply Chain Details */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Supply Chain Details (Optional)</Label>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="leadTimeDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lead Time (Days)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <Input
                            {...field}
                            type="number"
                            step="1"
                            min="0"
                            max="365"
                            placeholder="e.g., 14, 30, 60"
                            className="pl-10 h-12"
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                          />
                        </div>
                      </FormControl>
                      <FormDescription className="text-xs">
                        How many days from order to delivery
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="minimumOrderQuantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Minimum Order Quantity</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <ArrowLeftRight className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <Input
                            {...field}
                            type="number"
                            step="1"
                            placeholder="e.g., 10, 50, 100"
                            className="pl-10 h-12"
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                          />
                        </div>
                      </FormControl>
                      <FormDescription className="text-xs">
                        Minimum quantity required for orders
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Additional Details */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Additional Details (Optional)</Label>

              <FormField
                control={form.control}
                name="materialNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Material Specifications/Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Any special material specifications, handling requirements, quality notes, or other observations..."
                        className="min-h-[100px]"
                      />
                    </FormControl>
                    <FormDescription>
                      Include material details, quality requirements, special handling, or vendor notes
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
                className="flex-1 h-12 bg-amber-600 hover:bg-amber-700"
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