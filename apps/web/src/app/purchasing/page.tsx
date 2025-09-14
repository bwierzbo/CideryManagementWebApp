"use client"

import { useState } from "react"
import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { HarvestDatePicker } from "@/components/ui/harvest-date-picker"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import {
  Plus,
  Edit,
  Trash2,
  ShoppingCart,
  Building2,
  Receipt,
  Calendar,
  DollarSign,
  Package,
  Search,
  Filter
} from "lucide-react"
import { bushelsToKg, formatUnitConversion } from "lib"
import { trpc } from "@/utils/trpc"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

// Form schemas
const vendorSchema = z.object({
  name: z.string().min(1, "Name is required"),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().optional(),
  address: z.string().optional(),
})

const purchaseLineSchema = z.object({
  appleVarietyId: z.string().uuid("Select an apple variety"),
  quantity: z.number().positive("Quantity must be positive").optional(),
  unit: z.enum(["kg", "lb", "bushel"]),
  pricePerUnit: z.number().positive("Price must be positive").optional(),
  harvestDate: z.date().nullable().optional(),
})

const purchaseSchema = z.object({
  vendorId: z.string().uuid("Select a vendor"),
  purchaseDate: z.string().min(1, "Purchase date is required"),
  globalHarvestDate: z.date().nullable().optional(),
  notes: z.string().optional(),
  lines: z.array(purchaseLineSchema).min(1, "At least one apple variety is required"),
})

type VendorForm = z.infer<typeof vendorSchema>
type PurchaseForm = z.infer<typeof purchaseSchema>

function VendorManagement() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingVendor, setEditingVendor] = useState<string | null>(null)

  const { data: vendorData, refetch: refetchVendors } = trpc.vendor.list.useQuery()
  const vendors = vendorData?.vendors || []
  const createVendor = trpc.vendor.create.useMutation({
    onSuccess: () => {
      refetchVendors()
      setIsAddDialogOpen(false)
      reset()
    }
  })
  const deleteVendor = trpc.vendor.delete.useMutation({
    onSuccess: () => refetchVendors()
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm<VendorForm>({
    resolver: zodResolver(vendorSchema)
  })

  const onSubmit = (data: VendorForm) => {
    createVendor.mutate(data)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              Vendors
            </CardTitle>
            <CardDescription>Manage your apple suppliers and vendors</CardDescription>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Vendor
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Vendor</DialogTitle>
                <DialogDescription>
                  Create a new vendor to track apple purchases from.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <Label htmlFor="name">Vendor Name</Label>
                  <Input 
                    id="name" 
                    {...register("name")} 
                    placeholder="e.g., Mountain View Orchards"
                  />
                  {errors.name && <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>}
                </div>
                <div>
                  <Label htmlFor="contactEmail">Contact Email</Label>
                  <Input 
                    id="contactEmail" 
                    type="email"
                    {...register("contactEmail")} 
                    placeholder="contact@vendor.com"
                  />
                  {errors.contactEmail && <p className="text-sm text-red-600 mt-1">{errors.contactEmail.message}</p>}
                </div>
                <div>
                  <Label htmlFor="contactPhone">Contact Phone</Label>
                  <Input 
                    id="contactPhone" 
                    {...register("contactPhone")} 
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div>
                  <Label htmlFor="address">Address</Label>
                  <Input 
                    id="address" 
                    {...register("address")} 
                    placeholder="123 Farm Road, City, State"
                  />
                </div>
                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createVendor.isPending}>
                    {createVendor.isPending ? "Creating..." : "Create Vendor"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vendors.map((vendor: any) => (
              <TableRow key={vendor.id}>
                <TableCell className="font-medium">{vendor.name}</TableCell>
                <TableCell>{vendor.contactEmail || "—"}</TableCell>
                <TableCell>{vendor.contactPhone || "—"}</TableCell>
                <TableCell>
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                    vendor.isActive 
                      ? "bg-green-100 text-green-800" 
                      : "bg-red-100 text-red-800"
                  }`}>
                    {vendor.isActive ? "Active" : "Inactive"}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    <Button size="sm" variant="outline">
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => deleteVendor.mutate({ id: vendor.id })}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function PurchaseFormComponent() {
  const [globalHarvestDate, setGlobalHarvestDate] = useState<Date | null>(null)
  const [lines, setLines] = useState<Array<{
    appleVarietyId: string
    quantity: number | undefined
    unit: "kg" | "lb" | "bushel"
    pricePerUnit: number | undefined
    harvestDate: Date | null | undefined
  }>>([
    { appleVarietyId: "", quantity: undefined, unit: "kg", pricePerUnit: undefined, harvestDate: undefined }
  ])

  const { data: vendorData } = trpc.vendor.list.useQuery()
  const vendors = vendorData?.vendors || []
  const { data: appleVarietyData } = trpc.appleVariety.list.useQuery()
  const appleVarieties = appleVarietyData?.appleVarieties || []

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch
  } = useForm<PurchaseForm>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: {
      globalHarvestDate: null,
      lines: lines
    }
  })

  const addLine = () => {
    const newLines = [...lines, { appleVarietyId: "", quantity: undefined, unit: "kg" as "kg" | "lb" | "bushel", pricePerUnit: undefined, harvestDate: globalHarvestDate }]
    setLines(newLines)
    setValue("lines", newLines)
  }

  const removeLine = (index: number) => {
    const newLines = lines.filter((_, i) => i !== index)
    setLines(newLines)
    setValue("lines", newLines)
  }

  const calculateLineTotal = (quantity: number | undefined, price: number | undefined) => {
    const qty = quantity || 0
    const prc = price || 0
    return (qty * prc).toFixed(2)
  }

  const calculateGrandTotal = () => {
    return lines.reduce((total, line) => {
      const quantity = line.quantity || 0
      const price = line.pricePerUnit || 0
      return total + (quantity * price)
    }, 0).toFixed(2)
  }

  const getConversionDisplay = (quantity: number | undefined, unit: string) => {
    if (!quantity || unit !== 'bushel') return null
    try {
      return formatUnitConversion(quantity, 'bushels', 'kg')
    } catch {
      return null
    }
  }

  const onSubmit = (data: PurchaseForm) => {
    console.log("Purchase data:", data)
    // TODO: Implement purchase creation mutation
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-green-600" />
          Create Purchase Order
        </CardTitle>
        <CardDescription>Record a new apple purchase from vendors</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Purchase Header */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="vendorId">Vendor</Label>
              <Select onValueChange={(value) => setValue("vendorId", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select vendor" />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map((vendor: any) => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.vendorId && <p className="text-sm text-red-600 mt-1">{errors.vendorId.message}</p>}
            </div>
            <div>
              <Label htmlFor="purchaseDate">Purchase Date</Label>
              <Input
                id="purchaseDate"
                type="date"
                {...register("purchaseDate")}
              />
              {errors.purchaseDate && <p className="text-sm text-red-600 mt-1">{errors.purchaseDate.message}</p>}
            </div>
            <div>
              <HarvestDatePicker
                id="globalHarvestDate"
                label="Harvest Date (All Varieties)"
                placeholder="Select harvest date"
                value={globalHarvestDate}
                onChange={(date) => {
                  setGlobalHarvestDate(date)
                  setValue("globalHarvestDate", date)
                  // Auto-populate individual harvest dates
                  const newLines = lines.map(line => ({ ...line, harvestDate: date }))
                  setLines(newLines)
                  // Update form values for each line
                  newLines.forEach((_, index) => {
                    setValue(`lines.${index}.harvestDate`, date)
                  })
                }}
                showClearButton={true}
                allowFutureDates={false}
              />
            </div>
          </div>

          {/* Purchase Lines */}
          <div>
            <div className="mb-4">
              <h3 className="text-lg font-medium">Apple Varieties</h3>
            </div>

            <div className="space-y-4">
              {lines.map((line, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-7 gap-4 p-4 border rounded-lg">
                  <div className="md:col-span-2">
                    <Label>Apple Variety</Label>
                    <Select onValueChange={(value) => {
                      const newLines = [...lines]
                      newLines[index].appleVarietyId = value
                      setLines(newLines)
                      setValue(`lines.${index}.appleVarietyId`, value)
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select variety" />
                      </SelectTrigger>
                      <SelectContent>
                        {appleVarieties.map((variety: any) => (
                          <SelectItem key={variety.id} value={variety.id}>
                            {variety.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <HarvestDatePicker
                      id={`harvestDate-${index}`}
                      label="Harvest Date"
                      placeholder="Select date"
                      value={line.harvestDate}
                      onChange={(date) => {
                        const newLines = [...lines]
                        newLines[index].harvestDate = date
                        setLines(newLines)
                        setValue(`lines.${index}.harvestDate`, date)
                      }}
                      showClearButton={true}
                      allowFutureDates={false}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <Label>Quantity <span className="text-gray-500 text-sm">(Optional)</span></Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={line.quantity || ''}
                      placeholder="Enter quantity"
                      onChange={(e) => {
                        const newLines = [...lines]
                        newLines[index].quantity = e.target.value ? parseFloat(e.target.value) : undefined
                        setLines(newLines)
                        setValue(`lines.${index}.quantity`, newLines[index].quantity)
                      }}
                    />
                    {getConversionDisplay(line.quantity, line.unit) && (
                      <div className="text-xs text-gray-600 mt-1">
                        {getConversionDisplay(line.quantity, line.unit)}
                      </div>
                    )}
                  </div>
                  <div>
                    <Label>Unit</Label>
                    <Select value={line.unit} onValueChange={(value: "kg" | "lb" | "bushel") => {
                      const newLines = [...lines]
                      newLines[index].unit = value
                      setLines(newLines)
                      setValue(`lines.${index}.unit`, value)
                    }}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kg">kg</SelectItem>
                        <SelectItem value="lb">lb</SelectItem>
                        <SelectItem value="bushel">bushel</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Price/Unit <span className="text-gray-500 text-sm">(Optional)</span></Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={line.pricePerUnit || ''}
                      placeholder="Enter price"
                      onChange={(e) => {
                        const newLines = [...lines]
                        newLines[index].pricePerUnit = e.target.value ? parseFloat(e.target.value) : undefined
                        setLines(newLines)
                        setValue(`lines.${index}.pricePerUnit`, newLines[index].pricePerUnit)
                      }}
                    />
                  </div>
                  <div className="flex items-end">
                    <div className="w-full">
                      <Label>Total</Label>
                      <div className="text-lg font-semibold text-green-600">
                        ${calculateLineTotal(line.quantity, line.pricePerUnit)}
                      </div>
                    </div>
                    {lines.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeLine(index)}
                        className="ml-2"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Add Apple Variety Button - repositioned for mobile UX */}
            <div className="mt-4">
              <Button type="button" onClick={addLine} variant="outline" className="w-full md:w-auto">
                <Plus className="w-4 h-4 mr-2" />
                Add Apple Variety
              </Button>
            </div>

            <div className="flex justify-end mt-4">
              <div className="text-right">
                <p className="text-sm text-gray-600">Grand Total</p>
                <p className="text-2xl font-bold text-green-600">${calculateGrandTotal()}</p>
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Input 
              id="notes" 
              {...register("notes")} 
              placeholder="Additional notes..."
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline">
              Save as Draft
            </Button>
            <Button type="submit">
              Create Purchase Order
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function RecentPurchases() {
  // Mock data for now
  const purchases = [
    {
      id: "PO-2024-001",
      vendor: "Mountain View Orchards",
      date: "2024-01-15",
      items: "Honeycrisp (500kg), Gala (300kg)",
      total: "$1,250.00",
      status: "Delivered"
    },
    {
      id: "PO-2024-002", 
      vendor: "Sunrise Apple Farm",
      date: "2024-01-12",
      items: "Granny Smith (600kg)",
      total: "$1,080.00",
      status: "Pending"
    }
  ]

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-purple-600" />
              Recent Purchases
            </CardTitle>
            <CardDescription>Your latest purchase orders</CardDescription>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" size="sm">
              <Search className="w-4 h-4 mr-2" />
              Search
            </Button>
            <Button variant="outline" size="sm">
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order ID</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {purchases.map((purchase) => (
              <TableRow key={purchase.id}>
                <TableCell className="font-medium">{purchase.id}</TableCell>
                <TableCell>{purchase.vendor}</TableCell>
                <TableCell>{purchase.date}</TableCell>
                <TableCell className="max-w-xs truncate">{purchase.items}</TableCell>
                <TableCell className="font-semibold text-green-600">{purchase.total}</TableCell>
                <TableCell>
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                    purchase.status === "Delivered" 
                      ? "bg-green-100 text-green-800" 
                      : "bg-yellow-100 text-yellow-800"
                  }`}>
                    {purchase.status}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export default function PurchasingPage() {
  const [activeTab, setActiveTab] = useState<"vendors" | "purchase" | "history">("vendors")

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Purchasing</h1>
          <p className="text-gray-600 mt-1">
            Manage vendors, create purchase orders, and track apple procurement.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-8 bg-gray-100 p-1 rounded-lg w-fit">
          {[
            { key: "vendors", label: "Vendors", icon: Building2 },
            { key: "purchase", label: "New Purchase", icon: ShoppingCart },
            { key: "history", label: "Purchase History", icon: Receipt },
          ].map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <Icon className="w-4 h-4 mr-2" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Tab Content */}
        <div className="space-y-8">
          {activeTab === "vendors" && <VendorManagement />}
          {activeTab === "purchase" && <PurchaseFormComponent />}
          {activeTab === "history" && <RecentPurchases />}
        </div>
      </main>
    </div>
  )
}