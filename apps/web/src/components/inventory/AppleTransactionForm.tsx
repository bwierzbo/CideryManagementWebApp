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
  Apple,
  Scale,
  ArrowLeftRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Search,
  Calendar,
  Building2,
  MapPin,
  Info
} from "lucide-react"

// Form validation schema based on API apple transaction schema
const appleTransactionSchema = z.object({
  vendorId: z.string().uuid("Please select a vendor").optional(),
  appleVarietyId: z.string().uuid("Please select an apple variety"),
  quantityKg: z.number().min(0.1, "Quantity must be at least 0.1 kg").max(50000, "Quantity cannot exceed 50,000 kg"),
  qualityGrade: z.enum(['excellent', 'good', 'fair', 'poor'], {
    message: "Please select a quality grade"
  }).optional(),
  harvestDate: z.string().optional(),
  storageLocation: z.string().optional(),
  defectPercentage: z.number().min(0, "Defect percentage must be 0 or positive").max(100, "Defect percentage cannot exceed 100%").optional(),
  brixLevel: z.number().min(0, "Brix level must be positive").max(30, "Brix level cannot exceed 30").optional(),
  notes: z.string().optional(),
})

type AppleTransactionFormData = z.infer<typeof appleTransactionSchema>

// Mock data - will be replaced with tRPC calls
interface Vendor {
  id: string
  name: string
  contactInfo?: string
  location?: string
}

interface AppleVariety {
  id: string
  name: string
  ciderCategory: string
  intensity: string
  harvestWindow: string
  description?: string
}

const qualityGradeOptions = [
  { value: 'excellent', label: 'Excellent', description: 'Premium quality, minimal defects' },
  { value: 'good', label: 'Good', description: 'High quality, minor defects' },
  { value: 'fair', label: 'Fair', description: 'Acceptable quality, some defects' },
  { value: 'poor', label: 'Poor', description: 'Lower quality, significant defects' }
]

const storageLocationOptions = [
  { value: 'cold_storage', label: 'Cold Storage' },
  { value: 'cellar', label: 'Cellar' },
  { value: 'warehouse', label: 'Warehouse' },
  { value: 'receiving_area', label: 'Receiving Area' },
  { value: 'processing_room', label: 'Processing Room' }
]

interface AppleTransactionFormProps {
  onSubmit: (transaction: {
    vendorId?: string
    appleVarietyId: string
    quantityKg: number
    qualityGrade?: string
    harvestDate?: string
    storageLocation?: string
    defectPercentage?: number
    brixLevel?: number
    notes?: string
  }) => void
  onCancel?: () => void
  isSubmitting?: boolean
}

export function AppleTransactionForm({
  onSubmit,
  onCancel,
  isSubmitting = false
}: AppleTransactionFormProps) {
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null)
  const [selectedVariety, setSelectedVariety] = useState<AppleVariety | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [varietySearchQuery, setVarietySearchQuery] = useState("")

  // Mock vendors - will be replaced with tRPC query
  const mockVendors: Vendor[] = [
    {
      id: "vendor-1",
      name: "Mountain View Orchards",
      contactInfo: "contact@mountainview.com",
      location: "Washington State"
    },
    {
      id: "vendor-2",
      name: "Valley Apple Farm",
      contactInfo: "orders@valleyapple.com",
      location: "New York"
    },
    {
      id: "vendor-3",
      name: "Heritage Fruit Co.",
      contactInfo: "sales@heritagefruit.com",
      location: "Vermont"
    }
  ]

  // Mock apple varieties - will be replaced with tRPC query
  const mockVarieties: AppleVariety[] = [
    {
      id: "variety-1",
      name: "Dabinett",
      ciderCategory: "bittersweet",
      intensity: "medium-high",
      harvestWindow: "Mid-Late",
      description: "Classic English cider apple"
    },
    {
      id: "variety-2",
      name: "Kingston Black",
      ciderCategory: "bittersharp",
      intensity: "high",
      harvestWindow: "Late",
      description: "Premium vintage cider apple"
    },
    {
      id: "variety-3",
      name: "Granny Smith",
      ciderCategory: "sharp",
      intensity: "medium",
      harvestWindow: "Mid",
      description: "High acid dessert apple"
    },
    {
      id: "variety-4",
      name: "Gala",
      ciderCategory: "sweet",
      intensity: "low",
      harvestWindow: "Early-Mid",
      description: "Sweet dessert apple"
    }
  ]

  const form = useForm<AppleTransactionFormData>({
    resolver: zodResolver(appleTransactionSchema),
    defaultValues: {
      quantityKg: undefined,
      defectPercentage: 0,
      brixLevel: undefined,
      notes: ""
    }
  })

  // Watch for quantity changes to show conversion information
  const watchedQuantity = form.watch('quantityKg')

  // Unit conversion helpers for display
  const convertWeight = (weightKg: number): { pounds: number, tons: number } => {
    return {
      pounds: weightKg * 2.20462,
      tons: weightKg / 1000
    }
  }

  // Filter vendors based on search
  const filteredVendors = mockVendors.filter(vendor =>
    vendor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    vendor.location?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Filter varieties based on search
  const filteredVarieties = mockVarieties.filter(variety =>
    variety.name.toLowerCase().includes(varietySearchQuery.toLowerCase()) ||
    variety.ciderCategory.toLowerCase().includes(varietySearchQuery.toLowerCase())
  )

  const handleSubmit = (data: AppleTransactionFormData) => {
    onSubmit({
      vendorId: data.vendorId || undefined,
      appleVarietyId: data.appleVarietyId,
      quantityKg: data.quantityKg,
      qualityGrade: data.qualityGrade || undefined,
      harvestDate: data.harvestDate || undefined,
      storageLocation: data.storageLocation || undefined,
      defectPercentage: data.defectPercentage || undefined,
      brixLevel: data.brixLevel || undefined,
      notes: data.notes || undefined
    })
  }

  const handleVendorSelect = (vendorId: string) => {
    const vendor = mockVendors.find(v => v.id === vendorId)
    setSelectedVendor(vendor || null)
    form.setValue('vendorId', vendorId)
  }

  const handleVarietySelect = (varietyId: string) => {
    const variety = mockVarieties.find(v => v.id === varietyId)
    setSelectedVariety(variety || null)
    form.setValue('appleVarietyId', varietyId)
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Apple className="w-5 h-5 text-red-600" />
          <span>Apple Purchase Transaction</span>
        </CardTitle>
        <p className="text-sm text-gray-600">
          Record fresh apple purchases for inventory tracking
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Vendor Selection - Optional */}
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center">
                <Building2 className="w-4 h-4 mr-2" />
                Vendor (Optional)
              </Label>
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search vendors..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                {searchQuery && filteredVendors.length > 0 && (
                  <div className="border rounded-md max-h-40 overflow-y-auto">
                    {filteredVendors.map((vendor) => (
                      <button
                        key={vendor.id}
                        type="button"
                        onClick={() => handleVendorSelect(vendor.id)}
                        className="w-full p-3 text-left hover:bg-gray-50 border-b last:border-b-0 flex items-center justify-between"
                      >
                        <div>
                          <p className="font-medium">{vendor.name}</p>
                          <p className="text-sm text-gray-500">{vendor.location}</p>
                        </div>
                        {selectedVendor?.id === vendor.id && (
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {selectedVendor && (
                  <div className="bg-blue-50 border border-blue-200 rounded p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-blue-900">{selectedVendor.name}</p>
                        <p className="text-sm text-blue-700">{selectedVendor.location}</p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedVendor(null)
                          form.setValue('vendorId', '')
                          setSearchQuery("")
                        }}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Apple Variety Selection - Required */}
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center">
                <Apple className="w-4 h-4 mr-2" />
                Apple Variety *
              </Label>
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search apple varieties..."
                    value={varietySearchQuery}
                    onChange={(e) => setVarietySearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                {varietySearchQuery && filteredVarieties.length > 0 && (
                  <div className="border rounded-md max-h-40 overflow-y-auto">
                    {filteredVarieties.map((variety) => (
                      <button
                        key={variety.id}
                        type="button"
                        onClick={() => handleVarietySelect(variety.id)}
                        className="w-full p-3 text-left hover:bg-gray-50 border-b last:border-b-0 flex items-center justify-between"
                      >
                        <div>
                          <p className="font-medium">{variety.name}</p>
                          <div className="flex items-center space-x-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {variety.ciderCategory}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {variety.intensity} intensity
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {variety.harvestWindow}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">{variety.description}</p>
                        </div>
                        {selectedVariety?.id === variety.id && (
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {selectedVariety && (
                  <div className="bg-green-50 border border-green-200 rounded p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-green-900">{selectedVariety.name}</p>
                        <div className="flex items-center space-x-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {selectedVariety.ciderCategory}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {selectedVariety.intensity} intensity
                          </Badge>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedVariety(null)
                          form.setValue('appleVarietyId', '')
                          setVarietySearchQuery("")
                        }}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              <FormMessage />
            </div>

            {/* Quantity */}
            <FormField
              control={form.control}
              name="quantityKg"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center">
                    <Scale className="w-4 h-4 mr-2" />
                    Quantity (kg) *
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="Enter quantity in kilograms"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                    />
                  </FormControl>
                  {watchedQuantity && watchedQuantity > 0 && (
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <span>≈ {convertWeight(watchedQuantity).pounds.toFixed(1)} lbs</span>
                      <span>≈ {convertWeight(watchedQuantity).tons.toFixed(3)} tons</span>
                    </div>
                  )}
                  <FormDescription>
                    Enter the total weight of apples being received
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Quality Grade */}
            <FormField
              control={form.control}
              name="qualityGrade"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quality Grade</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select quality grade" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {qualityGradeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center justify-between w-full">
                            <span className="font-medium">{option.label}</span>
                            <span className="text-sm text-gray-500 ml-2">{option.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Assess overall quality based on appearance and defects
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Optional Fields Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Harvest Date */}
              <FormField
                control={form.control}
                name="harvestDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center">
                      <Calendar className="w-4 h-4 mr-2" />
                      Harvest Date
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      When were these apples harvested?
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Storage Location */}
              <FormField
                control={form.control}
                name="storageLocation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center">
                      <MapPin className="w-4 h-4 mr-2" />
                      Storage Location
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select storage location" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {storageLocationOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Where will these apples be stored?
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Quality Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Defect Percentage */}
              <FormField
                control={form.control}
                name="defectPercentage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center">
                      <AlertCircle className="w-4 h-4 mr-2" />
                      Defect Percentage
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        placeholder="0.0"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                      />
                    </FormControl>
                    <FormDescription>
                      Percentage of apples with defects or damage
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Brix Level */}
              <FormField
                control={form.control}
                name="brixLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center">
                      <Info className="w-4 h-4 mr-2" />
                      Brix Level
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max="30"
                        placeholder="Enter brix level"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                      />
                    </FormControl>
                    <FormDescription>
                      Sugar content measurement (°Brix)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional notes about this apple delivery..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Optional notes about quality, condition, or special handling requirements
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Form Actions */}
            <div className="flex items-center justify-end space-x-4 pt-6 border-t">
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
              )}
              <Button type="submit" disabled={isSubmitting} className="bg-red-600 hover:bg-red-700">
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Recording...
                  </>
                ) : (
                  <>
                    <Apple className="w-4 h-4 mr-2" />
                    Record Purchase
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