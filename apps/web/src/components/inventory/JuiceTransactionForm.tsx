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
  Scale,
  ArrowLeftRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Search,
  Droplets,
  Calendar,
  Building2,
  Package,
  Beaker,
  TestTube,
  BarChart3
} from "lucide-react"

// Form validation schema with juice-specific rules
const juiceTransactionSchema = z.object({
  vendorId: z.string().uuid("Please select a vendor"),
  juiceType: z.enum(['apple', 'pear', 'grape', 'mixed', 'other'], {
    message: "Please select a juice type"
  }),
  sourceDescription: z.string().min(1, "Source description/variety details are required"),
  volume: z.number().min(0.1, "Volume must be at least 0.1").max(10000, "Volume cannot exceed 10,000"),
  unit: z.enum(['gallons', 'liters', 'barrels'], { message: "Please select a unit" }),
  brixContent: z.number().min(0, "Brix content cannot be negative").max(30, "Brix content cannot exceed 30").optional(),
  phLevel: z.number().min(2.8, "pH level must be at least 2.8").max(4.2, "pH level cannot exceed 4.2").optional(),
  processingDate: z.string().optional(),
  tankContainer: z.string().optional(),
  unitCost: z.number().min(0, "Unit cost must be positive").optional(),
  totalCost: z.number().min(0, "Total cost must be positive").optional(),
  qualityNotes: z.string().optional(),
})

type JuiceTransactionFormData = z.infer<typeof juiceTransactionSchema>

// Mock data - will be replaced with tRPC calls
interface Vendor {
  id: string
  name: string
  contactInfo?: string
  specializesIn?: string[]
}

const juiceTypeOptions = [
  { value: 'apple', label: 'Apple', description: 'Fresh apple juice from various varieties' },
  { value: 'pear', label: 'Pear', description: 'Fresh pear juice from various varieties' },
  { value: 'grape', label: 'Grape', description: 'Fresh grape juice for blending' },
  { value: 'mixed', label: 'Mixed', description: 'Blend of different fruit juices' },
  { value: 'other', label: 'Other', description: 'Other fruit juices' }
]

const unitOptions = [
  { value: 'gallons', label: 'Gallons (gal)' },
  { value: 'liters', label: 'Liters (L)' },
  { value: 'barrels', label: 'Barrels (bbl)' }
]

interface JuiceTransactionFormProps {
  onSubmit: (transaction: {
    vendorId: string
    juiceType: string
    sourceDescription: string
    volume: number
    unit: string
    brixContent?: number
    phLevel?: number
    processingDate?: string
    tankContainer?: string
    unitCost?: number
    totalCost?: number
    qualityNotes?: string
  }) => void
  onCancel?: () => void
  isSubmitting?: boolean
}

export function JuiceTransactionForm({
  onSubmit,
  onCancel,
  isSubmitting = false
}: JuiceTransactionFormProps) {
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  // Mock vendors - will be replaced with tRPC query
  const mockVendors: Vendor[] = [
    {
      id: "vendor-1",
      name: "Orchard Fresh Juices",
      contactInfo: "contact@orchardfresh.com",
      specializesIn: ["apple", "pear"]
    },
    {
      id: "vendor-2",
      name: "Premium Fruit Co.",
      contactInfo: "orders@premiumfruit.com",
      specializesIn: ["grape", "mixed", "other"]
    },
    {
      id: "vendor-3",
      name: "Valley Juice Suppliers",
      contactInfo: "sales@valleyjuice.com",
      specializesIn: ["apple", "pear", "grape", "mixed", "other"]
    }
  ]

  const form = useForm<JuiceTransactionFormData>({
    resolver: zodResolver(juiceTransactionSchema),
    defaultValues: {
      unit: 'gallons',
      volume: undefined,
      unitCost: undefined,
      totalCost: undefined,
      sourceDescription: "",
      processingDate: "",
      tankContainer: "",
      qualityNotes: "",
      brixContent: undefined,
      phLevel: undefined,
    }
  })

  // Watch for volume and unit cost changes to calculate total
  const watchedVolume = form.watch('volume')
  const watchedUnitCost = form.watch('unitCost')

  // Calculate total cost automatically
  const calculateTotalCost = (): number => {
    if (watchedVolume && watchedUnitCost) {
      return watchedVolume * watchedUnitCost
    }
    return 0
  }

  // Update total cost when volume or unit cost changes
  const totalCost = calculateTotalCost()
  if (totalCost > 0 && form.getValues('totalCost') !== totalCost) {
    form.setValue('totalCost', totalCost)
  }

  // Volume conversion helpers for display
  const convertVolume = (volume: number, fromUnit: string, toUnit: string): number => {
    const conversions: { [key: string]: number } = {
      'gallons': 1,
      'liters': 0.264172,
      'barrels': 31 // 1 barrel = 31 gallons (US standard)
    }

    if (fromUnit === toUnit) return volume
    return (volume * conversions[fromUnit]) / conversions[toUnit]
  }

  // Filter vendors based on search
  const filteredVendors = mockVendors.filter(vendor =>
    vendor.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleSubmit = (data: JuiceTransactionFormData) => {
    onSubmit({
      vendorId: data.vendorId,
      juiceType: data.juiceType,
      sourceDescription: data.sourceDescription,
      volume: data.volume,
      unit: data.unit,
      brixContent: data.brixContent || undefined,
      phLevel: data.phLevel || undefined,
      processingDate: data.processingDate || undefined,
      tankContainer: data.tankContainer || undefined,
      unitCost: data.unitCost || undefined,
      totalCost: data.totalCost || undefined,
      qualityNotes: data.qualityNotes || undefined
    })
  }

  const handleVendorSelect = (vendorId: string) => {
    const vendor = mockVendors.find(v => v.id === vendorId)
    if (vendor) {
      setSelectedVendor(vendor)
      form.setValue('vendorId', vendor.id)
    }
  }

  const selectedJuiceType = form.watch('juiceType')
  const juiceTypeInfo = juiceTypeOptions.find(opt => opt.value === selectedJuiceType)

  // Validation helpers for real-time feedback
  const brixValue = form.watch('brixContent')
  const phValue = form.watch('phLevel')

  const getBrixStatus = (brix?: number) => {
    if (!brix) return null
    if (brix < 10) return { status: 'low', message: 'Low sugar content' }
    if (brix > 25) return { status: 'high', message: 'Very high sugar content' }
    return { status: 'good', message: 'Good sugar content' }
  }

  const getPhStatus = (ph?: number) => {
    if (!ph) return null
    if (ph < 3.0) return { status: 'warning', message: 'Very acidic' }
    if (ph > 4.0) return { status: 'warning', message: 'Low acidity' }
    return { status: 'good', message: 'Good pH level' }
  }

  const brixStatus = getBrixStatus(brixValue)
  const phStatus = getPhStatus(phValue)

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <div className="bg-blue-100 rounded-full p-2">
            <Droplets className="w-5 h-5 text-blue-600" />
          </div>
          <span>Record Juice Transaction</span>
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
                        ? 'border-blue-500 bg-blue-50'
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

            {/* Juice Type and Source Details */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <Label className="text-base font-medium">Juice Details</Label>

                {/* Juice Type */}
                <FormField
                  control={form.control}
                  name="juiceType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Juice Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-12">
                            <SelectValue placeholder="Select juice type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {juiceTypeOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              <div>
                                <div className="font-medium">{option.label}</div>
                                <div className="text-xs text-gray-500">{option.description}</div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {juiceTypeInfo && (
                        <FormDescription className="text-xs">
                          {juiceTypeInfo.description}
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Source Description */}
                <FormField
                  control={form.control}
                  name="sourceDescription"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Source Description/Variety Details</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="e.g., Honeycrisp blend, Bartlett pears, Pinot Noir"
                          className="h-12"
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        Specify fruit varieties, blend composition, or source details
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Processing Date */}
                <FormField
                  control={form.control}
                  name="processingDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Processing Date</FormLabel>
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
                      <FormDescription className="text-xs">
                        When was this juice processed/extracted?
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4">
                <Label className="text-base font-medium">Volume & Pricing</Label>

                {/* Volume and Unit */}
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="volume"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Volume</FormLabel>
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
                          Auto-calculated from volume × unit cost
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>

            {/* Quality Measurements */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Quality Measurements</Label>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="brixContent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Brix/Sugar Content (0-30)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <BarChart3 className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <Input
                            {...field}
                            type="number"
                            step="0.1"
                            min="0"
                            max="30"
                            placeholder="e.g., 14.5"
                            className="pl-10 h-12"
                            onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                          />
                          {brixStatus && (
                            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                              {brixStatus.status === 'good' && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                              {brixStatus.status === 'low' && <AlertCircle className="w-4 h-4 text-amber-600" />}
                              {brixStatus.status === 'high' && <AlertCircle className="w-4 h-4 text-red-600" />}
                            </div>
                          )}
                        </div>
                      </FormControl>
                      <FormDescription className="text-xs">
                        {brixStatus ? brixStatus.message : "Sugar content measurement (°Brix)"}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>pH Level (2.8-4.2)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <TestTube className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <Input
                            {...field}
                            type="number"
                            step="0.1"
                            min="2.8"
                            max="4.2"
                            placeholder="e.g., 3.5"
                            className="pl-10 h-12"
                            onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                          />
                          {phStatus && (
                            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                              {phStatus.status === 'good' && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                              {phStatus.status === 'warning' && <AlertCircle className="w-4 h-4 text-amber-600" />}
                            </div>
                          )}
                        </div>
                      </FormControl>
                      <FormDescription className="text-xs">
                        {phStatus ? phStatus.message : "Acidity level (safe range: 2.8-4.2)"}
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
                name="tankContainer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tank/Container Assignment</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Package className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                          {...field}
                          placeholder="e.g., Tank A-1, Vessel 205, Storage Tank 3"
                          className="pl-10 h-12"
                        />
                      </div>
                    </FormControl>
                    <FormDescription>
                      Specify where this juice will be stored or processed
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="qualityNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quality Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Any observations about color, clarity, taste, aroma, or other quality aspects..."
                        className="min-h-[100px]"
                      />
                    </FormControl>
                    <FormDescription>
                      Document quality observations, intended use, or any special handling notes
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
                className="flex-1 h-12 bg-blue-600 hover:bg-blue-700"
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