"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollableSelectContent } from "@/components/ui/scrollable-select"
import { ScrollableContainer } from "@/components/ui/scrollable-container"
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
  Filter,
  CheckCircle,
  XCircle,
  X,
  RefreshCw,
  Apple,
  Tag,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText
} from "lucide-react"
import { bushelsToKg } from "lib"
import { trpc } from "@/utils/trpc"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

// Helper function to download blob as file
const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Helper function to convert base64 to blob
const base64ToBlob = (base64: string, contentType: string): Blob => {
  const byteCharacters = atob(base64)
  const byteNumbers = new Array(byteCharacters.length)
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }
  const byteArray = new Uint8Array(byteNumbers)
  return new Blob([byteArray], { type: contentType })
}

// Form schemas
const vendorSchema = z.object({
  name: z.string().min(1, "Name is required"),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().optional(),
  address: z.string().optional(),
})

const purchaseLineSchema = z.object({
  fruitVarietyId: z.string().uuid("Select an apple variety"),
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

function VendorManagement({ preSelectedVendorId }: { preSelectedVendorId?: string | null }) {
  const { data: session } = useSession()
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingVendor, setEditingVendor] = useState<any>(null)
  const [selectedVendor, setSelectedVendor] = useState<any>(null)
  const [isAddVarietyModalOpen, setIsAddVarietyModalOpen] = useState(false)
  const [varietySearchQuery, setVarietySearchQuery] = useState('')

  const { data: vendorData, refetch: refetchVendors } = trpc.vendor.list.useQuery()
  const vendors = vendorData?.vendors || []

  // Handle pre-selected vendor
  React.useEffect(() => {
    if (preSelectedVendorId && vendors.length > 0) {
      const vendor = vendors.find(v => v.id === preSelectedVendorId)
      if (vendor) {
        setSelectedVendor(vendor)
      }
    }
  }, [preSelectedVendorId, vendors])
  const createVendor = trpc.vendor.create.useMutation({
    onSuccess: () => {
      refetchVendors()
      setIsAddDialogOpen(false)
      reset()
    }
  })
  const updateVendor = trpc.vendor.update.useMutation({
    onSuccess: () => {
      refetchVendors()
      setIsEditDialogOpen(false)
      setEditingVendor(null)
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
    if (editingVendor) {
      updateVendor.mutate({ ...data, id: editingVendor.id })
    } else {
      createVendor.mutate(data)
    }
  }

  const handleEdit = (vendor: any) => {
    setEditingVendor(vendor)
    // Pre-populate the form with vendor data
    reset({
      name: vendor.name,
      contactEmail: vendor.contactInfo?.email || "",
      contactPhone: vendor.contactInfo?.phone || "",
      address: vendor.contactInfo?.address || "",
    })
    setIsEditDialogOpen(true)
  }

  const handleAddNew = () => {
    setEditingVendor(null)
    reset()
    setIsAddDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsAddDialogOpen(false)
    setIsEditDialogOpen(false)
    setEditingVendor(null)
    reset()
  }

  return (
    <div className="space-y-6">
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
            <div className="flex items-center gap-2">
              <Dialog open={isAddDialogOpen || isEditDialogOpen} onOpenChange={(open) => {
                if (!open) handleCloseDialog()
              }}>
                <DialogTrigger asChild>
                  <Button onClick={handleAddNew}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Vendor
                  </Button>
                </DialogTrigger>
              </Dialog>

              <Button variant="outline" size="sm" asChild>
                <Link href="/apples" className="flex items-center gap-1">
                  <Apple className="w-4 h-4" />
                  <span className="hidden sm:inline">Manage master varieties</span>
                  <span className="sm:hidden">Varieties</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Dialog open={isAddDialogOpen || isEditDialogOpen} onOpenChange={(open) => {
            if (!open) handleCloseDialog()
          }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingVendor ? 'Edit Vendor' : 'Add New Vendor'}</DialogTitle>
                <DialogDescription>
                  {editingVendor
                    ? 'Update vendor information and contact details.'
                    : 'Create a new vendor to track apple purchases from.'}
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
                  <Button type="button" variant="outline" onClick={handleCloseDialog}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createVendor.isPending || updateVendor.isPending}>
                    {editingVendor
                      ? (updateVendor.isPending ? "Updating..." : "Update Vendor")
                      : (createVendor.isPending ? "Creating..." : "Create Vendor")
                    }
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </CardContent>
        <CardContent>
        {/* Desktop Table */}
        <div className="hidden md:block">
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
                <TableRow
                  key={vendor.id}
                  className={`cursor-pointer hover:bg-gray-50 ${
                    selectedVendor?.id === vendor.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                  }`}
                  onClick={() => setSelectedVendor(vendor)}
                >
                  <TableCell className="font-medium">{vendor.name}</TableCell>
                  <TableCell>{vendor.contactInfo?.email || "—"}</TableCell>
                  <TableCell>{vendor.contactInfo?.phone || "—"}</TableCell>
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
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEdit(vendor)
                        }}
                        title="Edit vendor"
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteVendor.mutate({ id: vendor.id })
                        }}
                        title="Delete vendor"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden space-y-4">
          {vendors.map((vendor: any) => (
            <Card
              key={vendor.id}
              className={`border border-gray-200 cursor-pointer ${
                selectedVendor?.id === vendor.id ? 'border-blue-500 bg-blue-50' : ''
              }`}
              onClick={() => setSelectedVendor(vendor)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{vendor.name}</h3>
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full mt-1 ${
                      vendor.isActive
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}>
                      {vendor.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="flex space-x-2 ml-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEdit(vendor)
                      }}
                      title="Edit vendor"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteVendor.mutate({ id: vendor.id })
                      }}
                      title="Delete vendor"
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-1 text-sm text-gray-600">
                  <div className="flex items-center">
                    <span className="font-medium w-16">Email:</span>
                    <span>{vendor.contactInfo?.email || "—"}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-medium w-16">Phone:</span>
                    <span>{vendor.contactInfo?.phone || "—"}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>

    {/* Apple Varieties Panel */}
    {selectedVendor && <VendorVarietiesPanel vendor={selectedVendor} />}
  </div>
  )
}

function VendorVarietiesPanel({ vendor }: { vendor: any }) {
  const [isAddVarietyModalOpen, setIsAddVarietyModalOpen] = useState(false)

  // TODO: Replace with actual role check from session/auth
  const isAdmin = true // For now, assume all users are admin for testing

  // tRPC hooks for vendor varieties
  const { data: varietiesData, refetch: refetchVarieties } = trpc.vendorVariety.listForVendor.useQuery(
    { vendorId: vendor.id },
    { enabled: !!vendor.id }
  )

  const detachVariety = trpc.vendorVariety.detach.useMutation({
    onSuccess: () => {
      refetchVarieties()
    }
  })

  const varieties = varietiesData?.varieties || []

  const handleDetachVariety = (varietyId: string) => {
    detachVariety.mutate({
      vendorId: vendor.id,
      varietyId
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Apple className="w-5 h-5 text-green-600" />
              Apple Varieties for {vendor.name}
            </CardTitle>
            <CardDescription>
              Manage which apple varieties this vendor can supply
            </CardDescription>
          </div>
          {isAdmin && (
            <Dialog open={isAddVarietyModalOpen} onOpenChange={setIsAddVarietyModalOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Apple Variety
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
                <AddVarietyModal
                  vendor={vendor}
                  isOpen={isAddVarietyModalOpen}
                  onClose={() => setIsAddVarietyModalOpen(false)}
                  onSuccess={() => {
                    // refetchVarieties()
                    setIsAddVarietyModalOpen(false)
                  }}
                />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {varieties.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Apple className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium mb-2">No varieties linked</h3>
            <p className="text-sm mb-4">Add the first apple variety this vendor can supply.</p>
            {isAdmin && (
              <Button onClick={() => setIsAddVarietyModalOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Apple Variety
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Desktop and Tablet view */}
            <div className="hidden sm:block">
              <ScrollableContainer maxHeight="16rem">
                <div className="flex flex-wrap gap-2 p-1">
                  {varieties.map((variety) => (
                    <div
                      key={variety.id}
                      className="flex items-center gap-2 bg-green-100 text-green-800 px-3 py-2 rounded-full text-sm flex-shrink-0"
                    >
                      <Tag className="w-3 h-3" />
                      <span className="font-medium">{variety.name}</span>
                      {isAdmin && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-4 w-4 p-0 hover:bg-red-100 text-green-600 hover:text-red-600"
                          onClick={() => handleDetachVariety(variety.id)}
                          title="Remove variety"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollableContainer>
            </div>

            {/* Mobile view */}
            <div className="sm:hidden">
              <ScrollableContainer maxHeight="16rem">
                <div className="space-y-2 p-1">
                  {varieties.map((variety) => (
                    <div
                      key={variety.id}
                      className="flex items-center justify-between bg-green-50 border border-green-200 px-4 py-3 rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-green-600" />
                        <span className="font-medium text-green-800">{variety.name}</span>
                      </div>
                      {isAdmin && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:text-red-700 hover:bg-red-100"
                          onClick={() => handleDetachVariety(variety.id)}
                          title="Remove variety"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollableContainer>
            </div>

            {varieties.length > 0 && (
              <div className="text-sm text-gray-500 mt-4">
                {varieties.length} {varieties.length === 1 ? 'variety' : 'varieties'} linked
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function AddVarietyModal({ vendor, isOpen, onClose, onSuccess }: {
  vendor: any
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedVariety, setSelectedVariety] = useState<any>(null)
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const [notes, setNotes] = useState('')

  // Search varieties with debounced query
  const { data: searchResults } = trpc.vendorVariety.search.useQuery(
    { q: searchQuery, limit: 10 },
    { enabled: searchQuery.length >= 2 }
  )

  const attachVariety = trpc.vendorVariety.attach.useMutation({
    onSuccess: () => {
      onSuccess()
      setSearchQuery('')
      setSelectedVariety(null)
      setIsCreatingNew(false)
      setNotes('')
    }
  })

  const varieties = searchResults?.varieties || []


  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    setSelectedVariety(null)
    setIsCreatingNew(false)
  }

  const canCreateNew = searchQuery.trim().length >= 2 &&
    varieties.length === 0 &&
    !varieties.some(v => v.name.toLowerCase() === searchQuery.toLowerCase())

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Apple className="w-5 h-5 text-green-600" />
          Add Apple Variety
        </DialogTitle>
        <DialogDescription>
          Search for an existing variety or create a new one for {vendor.name}.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 mt-4">
        {/* Search Input */}
        <div>
          <Label htmlFor="variety-search">Apple Variety</Label>
          <Input
            id="variety-search"
            placeholder="Search for apple varieties..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="h-12"
          />
        </div>

        {/* Search Results */}
        {searchQuery.length >= 2 && (
          <div className="space-y-2">
            {varieties.length > 0 && (
              <div className="space-y-1">
                <Label className="text-sm text-gray-600">Existing varieties:</Label>
                <ScrollableContainer maxHeight="8rem">
                  <div className="space-y-1 p-1">
                    {varieties.map((variety) => (
                      <div
                        key={variety.id}
                        className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedVariety?.id === variety.id
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => {
                          setSelectedVariety(variety)
                          setIsCreatingNew(false)
                        }}
                      >
                        <Tag className="w-4 h-4 text-green-600" />
                        <span className="font-medium">{variety.name}</span>
                      </div>
                    ))}
                  </div>
                </ScrollableContainer>
              </div>
            )}

            {/* Create New Option */}
            {canCreateNew && (
              <div className="space-y-1">
                <Label className="text-sm text-gray-600">Or create new:</Label>
                <div
                  className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                    isCreatingNew
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => {
                    setIsCreatingNew(true)
                    setSelectedVariety(null)
                  }}
                >
                  <Plus className="w-4 h-4 text-blue-600" />
                  <span className="font-medium">Create &quot;{searchQuery}&quot; and link</span>
                </div>
              </div>
            )}
          </div>
        )}

        {searchQuery.length > 0 && searchQuery.length < 2 && (
          <p className="text-sm text-gray-500">Type at least 2 characters to search</p>
        )}
      </div>

      {/* Notes Field - Only show when creating new variety */}
      {isCreatingNew && (
        <div>
          <Label htmlFor="notes">Notes (Optional)</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes about this variety for this vendor (e.g., 'Premium grade, excellent for single varietal ciders')"
            rows={3}
          />
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>

        {/* Link Existing Variety Button */}
        {selectedVariety && (
          <Button
            onClick={() => {
              attachVariety.mutate({
                vendorId: vendor.id,
                varietyNameOrId: selectedVariety.id,
                // No notes for existing varieties
              })
            }}
            disabled={attachVariety.isPending}
          >
            {attachVariety.isPending ? "Linking..." : `Link ${selectedVariety.name}`}
          </Button>
        )}

        {/* Create New Variety Button */}
        {isCreatingNew && (
          <Button
            onClick={() => {
              attachVariety.mutate({
                vendorId: vendor.id,
                varietyNameOrId: searchQuery.trim(),
                notes: notes.trim() || undefined
              })
            }}
            disabled={attachVariety.isPending}
          >
            {attachVariety.isPending ? "Creating..." : `Create & Link "${searchQuery}"`}
          </Button>
        )}
      </div>
    </>
  )
}

type NotificationType = {
  id: number
  type: 'success' | 'error'
  title: string
  message: string
}

function PurchaseFormComponent({ setPreSelectedVendorId, setActiveTab }: {
  setPreSelectedVendorId: (id: string) => void
  setActiveTab: (tab: "purchase" | "vendors" | "history" | "vendor-varieties") => void
}) {
  const { data: session } = useSession()
  const [globalHarvestDate, setGlobalHarvestDate] = useState<Date | null>(null)
  const [purchaseDate, setPurchaseDate] = useState<string>("")
  const [notifications, setNotifications] = useState<NotificationType[]>([])
  const [selectedVendorId, setSelectedVendorId] = useState<string>("")
  const [lines, setLines] = useState<Array<{
    fruitVarietyId: string
    quantity: number | undefined
    unit: "kg" | "lb" | "bushel"
    pricePerUnit: number | undefined
    harvestDate: Date | null | undefined
    isValid?: boolean
    validationError?: string
  }>>([
    { fruitVarietyId: "", quantity: undefined, unit: "lb", pricePerUnit: undefined, harvestDate: undefined, isValid: true }
  ])

  const addNotification = (type: 'success' | 'error', title: string, message: string) => {
    const id = Date.now()
    setNotifications(prev => [...prev, { id, type, title, message }])
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id))
    }, 5000) // Auto-dismiss after 5 seconds
  }

  const removeNotification = (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const { data: vendorData } = trpc.vendor.list.useQuery()
  const vendors = vendorData?.vendors || []

  // Get vendor varieties when vendor is selected
  const { data: vendorVarietiesData } = trpc.vendorVariety.listForVendor.useQuery(
    { vendorId: selectedVendorId },
    { enabled: !!selectedVendorId }
  )
  const vendorVarieties = vendorVarietiesData?.varieties || []

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset
  } = useForm<PurchaseForm>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: {
      globalHarvestDate: null,
      lines: lines
    }
  })

  const handlePurchaseDateChange = (dateString: string) => {
    setPurchaseDate(dateString)
    setValue("purchaseDate", dateString)
  }

  const addLine = () => {
    // Use global harvest date for new lines if available
    const harvestDateForNewLine = globalHarvestDate
    const newLines = [...lines, { fruitVarietyId: "", quantity: undefined, unit: "lb" as "kg" | "lb" | "bushel", pricePerUnit: undefined, harvestDate: harvestDateForNewLine, isValid: true }]
    setLines(newLines)
    setValue("lines", newLines)
  }

  const handleVendorChange = (newVendorId: string) => {
    setSelectedVendorId(newVendorId)
    setValue("vendorId", newVendorId)

    // Validate existing lines against new vendor
    if (newVendorId && lines.some(line => line.fruitVarietyId)) {
      // We'll validate when vendor varieties are loaded
      // This will be handled by useEffect
    }
  }

  const validateLines = () => {
    if (!selectedVendorId || vendorVarieties.length === 0) return

    const validVarietyIds = new Set(vendorVarieties.map(v => v.id))
    const newLines = lines.map(line => {
      if (!line.fruitVarietyId) {
        return { ...line, isValid: true, validationError: undefined }
      }

      const isValid = validVarietyIds.has(line.fruitVarietyId)
      return {
        ...line,
        isValid,
        validationError: isValid ? undefined : "This variety is not available for the selected vendor"
      }
    })

    setLines(newLines)
  }

  // Validate lines when vendor varieties change
  React.useEffect(() => {
    validateLines()
  }, [vendorVarieties, selectedVendorId])

  const removeLine = (index: number) => {
    const newLines = lines.filter((_, i) => i !== index)
    setLines(newLines)
    setValue("lines", newLines)
  }

  const calculateLineTotal = (quantity: number | undefined, price: number | undefined) => {
    if (!quantity || !price) return "—"
    return (quantity * price).toFixed(2)
  }

  const createPurchase = trpc.purchase.create.useMutation({
    onSuccess: (result) => {
      addNotification('success', 'Purchase Created Successfully!', `Invoice ${result.purchase.invoiceNumber} has been generated`)
      // Reset form
      reset()
      setLines([{ fruitVarietyId: "", quantity: undefined, unit: "lb" as "kg" | "lb" | "bushel", pricePerUnit: undefined, harvestDate: null }])
      setPurchaseDate("")
      setGlobalHarvestDate(null)
    },
    onError: (error) => {
      addNotification('error', 'Failed to Create Purchase', error.message)
    }
  })

  const calculateGrandTotal = () => {
    const total = lines.reduce((total, line) => {
      if (!line.quantity || !line.pricePerUnit) return total
      return total + (line.quantity * line.pricePerUnit)
    }, 0)
    return total > 0 ? total.toFixed(2) : "—"
  }

  const onSubmit = (data: PurchaseForm) => {
    // Check for validation errors before submitting
    const hasInvalidLines = lines.some(line => line.isValid === false)
    if (hasInvalidLines) {
      addNotification('error', 'Invalid Varieties', 'Please fix variety selections that are not available for the selected vendor')
      return
    }

    try {
      // Convert form data to API format
      const items = data.lines
        .filter(line => line.fruitVarietyId && line.quantity) // Only include complete lines
        .map(line => ({
          fruitVarietyId: line.fruitVarietyId,
          quantity: line.quantity!,
          unit: line.unit as 'kg' | 'lb' | 'L' | 'gal' | 'bushel',
          pricePerUnit: line.pricePerUnit,
          harvestDate: line.harvestDate || undefined,
          notes: undefined // Frontend doesn't have notes per line
        }))

      if (items.length === 0) {
        addNotification('error', 'Incomplete Form', 'Please add at least one apple variety with quantity')
        return
      }

      // Submit to API
      createPurchase.mutate({
        vendorId: data.vendorId,
        purchaseDate: new Date(data.purchaseDate),
        notes: data.notes,
        items: items
      })
    } catch (error) {
      console.error('Error preparing purchase data:', error)
      addNotification('error', 'Form Error', 'Error preparing purchase data. Please check your inputs.')
    }
  }

  return (
    <>
      {/* Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`
              min-w-80 max-w-md p-4 rounded-lg shadow-lg border
              ${notification.type === 'success'
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-red-50 border-red-200 text-red-800'
              }
            `}
          >
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 mt-0.5">
                {notification.type === 'success' ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{notification.title}</p>
                <p className="text-sm mt-1 opacity-90">{notification.message}</p>
              </div>
              <button
                onClick={() => removeNotification(notification.id)}
                className="flex-shrink-0 ml-4 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="sm:col-span-2 lg:col-span-1">
              <Label htmlFor="vendorId">Vendor</Label>
              <Select onValueChange={handleVendorChange}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Select vendor" />
                </SelectTrigger>
                <ScrollableSelectContent maxHeight="200px">
                  {vendors.map((vendor: any) => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </SelectItem>
                  ))}
                </ScrollableSelectContent>
              </Select>
              {errors.vendorId && <p className="text-sm text-red-600 mt-1">{errors.vendorId.message}</p>}
            </div>
            <div>
              <Label htmlFor="purchaseDate">Purchase Date</Label>
              <Input
                id="purchaseDate"
                type="date"
                value={purchaseDate}
                onChange={(e) => handlePurchaseDateChange(e.target.value)}
                className="h-12"
              />
              {errors.purchaseDate && <p className="text-sm text-red-600 mt-1">{errors.purchaseDate.message}</p>}
            </div>
            <div className="sm:col-span-2 lg:col-span-1">
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
                <div key={index} className="border rounded-lg p-4">
                  {/* Desktop Layout */}
                  <div className="hidden lg:grid lg:grid-cols-7 gap-4">
                    <div className="lg:col-span-2">
                      <Label>Apple Variety</Label>
                      <Select onValueChange={(value) => {
                        const newLines = [...lines]
                        newLines[index].fruitVarietyId = value
                        setLines(newLines)
                        setValue(`lines.${index}.fruitVarietyId`, value)
                      }}>
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="Select variety" />
                        </SelectTrigger>
                        <SelectContent>
                          {vendorVarieties.map((variety: any) => (
                            <SelectItem key={variety.id} value={variety.id}>
                              {variety.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {line.validationError && (
                        <p className="text-sm text-red-600 mt-1">{line.validationError}</p>
                      )}
                      {selectedVendorId && vendorVarieties.length === 0 && (
                        <p className="text-xs text-gray-500 mt-1">
                          Need a new variety? {(session?.user as any)?.role === 'admin' ? (
                            <>Visit the <Link href="/apples" className="text-blue-600 hover:underline">Apples page</Link> to add it.</>
                          ) : (
                            'Ask an Admin to add it on the Apples page.'
                          )}
                        </p>
                      )}
                      {selectedVendorId && (
                        <button
                          type="button"
                          onClick={() => {
                            setPreSelectedVendorId(selectedVendorId)
                            setActiveTab("vendor-varieties")
                          }}
                          className="text-sm text-blue-600 hover:text-blue-800 underline mt-1"
                        >
                          Manage vendor varieties
                        </button>
                      )}
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
                        className="h-10"
                        onChange={(e) => {
                          const newLines = [...lines]
                          newLines[index].quantity = e.target.value ? parseFloat(e.target.value) : undefined
                          setLines(newLines)
                          setValue(`lines.${index}.quantity`, newLines[index].quantity)
                        }}
                      />
                    </div>
                    <div>
                      <Label>Unit</Label>
                      <Select value={line.unit} onValueChange={(value: "kg" | "lb" | "bushel") => {
                        const newLines = [...lines]
                        newLines[index].unit = value
                        setLines(newLines)
                        setValue(`lines.${index}.unit`, value)
                      }}>
                        <SelectTrigger className="h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="lb">lb</SelectItem>
                          <SelectItem value="kg">kg</SelectItem>
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
                        className="h-10"
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

                  {/* Mobile/Tablet Layout */}
                  <div className="lg:hidden space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-gray-900">Apple Variety #{index + 1}</h4>
                      {lines.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeLine(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>

                    {/* Apple Variety Selection */}
                    <div>
                      <Label>Apple Variety</Label>
                      <Select onValueChange={(value) => {
                        const newLines = [...lines]
                        newLines[index].fruitVarietyId = value
                        setLines(newLines)
                        setValue(`lines.${index}.fruitVarietyId`, value)
                      }}>
                        <SelectTrigger className="h-12">
                          <SelectValue placeholder="Select variety" />
                        </SelectTrigger>
                        <SelectContent>
                          {vendorVarieties.map((variety: any) => (
                            <SelectItem key={variety.id} value={variety.id}>
                              {variety.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {line.validationError && (
                        <p className="text-sm text-red-600 mt-1">{line.validationError}</p>
                      )}
                      {selectedVendorId && vendorVarieties.length === 0 && (
                        <p className="text-xs text-gray-500 mt-1">
                          Need a new variety? {(session?.user as any)?.role === 'admin' ? (
                            <>Visit the <Link href="/apples" className="text-blue-600 hover:underline">Apples page</Link> to add it.</>
                          ) : (
                            'Ask an Admin to add it on the Apples page.'
                          )}
                        </p>
                      )}
                      {selectedVendorId && (
                        <button
                          type="button"
                          onClick={() => {
                            setPreSelectedVendorId(selectedVendorId)
                            setActiveTab("vendor-varieties")
                          }}
                          className="text-sm text-blue-600 hover:text-blue-800 underline mt-1"
                        >
                          Manage vendor varieties
                        </button>
                      )}
                    </div>

                    {/* Harvest Date */}
                    <div>
                      <HarvestDatePicker
                        id={`harvestDate-mobile-${index}`}
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

                    {/* Quantity and Unit in a grid */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Quantity <span className="text-gray-500 text-sm">(Optional)</span></Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={line.quantity || ''}
                          placeholder="0.00"
                          className="h-12"
                          onChange={(e) => {
                            const newLines = [...lines]
                            newLines[index].quantity = e.target.value ? parseFloat(e.target.value) : undefined
                            setLines(newLines)
                            setValue(`lines.${index}.quantity`, newLines[index].quantity)
                          }}
                        />
                      </div>
                      <div>
                        <Label>Unit</Label>
                        <Select value={line.unit} onValueChange={(value: "kg" | "lb" | "bushel") => {
                          const newLines = [...lines]
                          newLines[index].unit = value
                          setLines(newLines)
                          setValue(`lines.${index}.unit`, value)
                        }}>
                          <SelectTrigger className="h-12">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="lb">lb</SelectItem>
                            <SelectItem value="kg">kg</SelectItem>
                            <SelectItem value="bushel">bushel</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Price and Total */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Price/Unit <span className="text-gray-500 text-sm">(Optional)</span></Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={line.pricePerUnit || ''}
                          placeholder="0.00"
                          className="h-12"
                          onChange={(e) => {
                            const newLines = [...lines]
                            newLines[index].pricePerUnit = e.target.value ? parseFloat(e.target.value) : undefined
                            setLines(newLines)
                            setValue(`lines.${index}.pricePerUnit`, newLines[index].pricePerUnit)
                          }}
                        />
                      </div>
                      <div>
                        <Label>Total</Label>
                        <div className="h-12 flex items-center">
                          <div className="text-xl font-semibold text-green-600">
                            {(line.quantity != null && line.quantity > 0) && line.pricePerUnit
                              ? `$${(line.quantity * line.pricePerUnit).toFixed(2)}`
                              : <span className="text-gray-400">$—</span>
                            }
                          </div>
                        </div>
                      </div>
                    </div>
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

          <div className="flex justify-end">
            <Button type="submit" disabled={createPurchase.isPending}>
              {createPurchase.isPending ? "Creating..." : "Create Purchase Order"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
    </>
  )
}

interface EditPurchaseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  purchase: any | null
  onSuccess: () => void
  onError: (error: string) => void
}

function EditPurchaseDialog({ open, onOpenChange, purchase, onSuccess, onError }: EditPurchaseDialogProps) {
  const utils = trpc.useUtils()
  const updatePurchase = trpc.purchase.update.useMutation({
    onSuccess: async () => {
      // Invalidate and refetch purchase list
      await utils.purchase.list.invalidate()
      onSuccess()
    },
    onError: (error) => {
      onError(error.message)
    }
  })
  const { data: vendorData } = trpc.vendor.list.useQuery()
  const { data: varietyData } = trpc.fruitVariety.listAll.useQuery({ includeInactive: false })

  const vendors = vendorData?.vendors || []
  const varieties = varietyData?.baseFruitVarieties || []

  const [formData, setFormData] = useState({
    vendorId: '',
    purchaseDate: '',
    notes: '',
  })

  // Helper function to format date for input field (timezone safe)
  const formatDateForInput = (dateString: string) => {
    const date = new Date(dateString)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Update form data when purchase changes
  useEffect(() => {
    if (purchase) {
      setFormData({
        vendorId: purchase.vendorId || '',
        purchaseDate: purchase.purchaseDate ? formatDateForInput(purchase.purchaseDate) : '',
        notes: purchase.notes || '',
      })
    }
  }, [purchase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!purchase) return

    updatePurchase.mutate({
      id: purchase.id,
      ...formData,
      purchaseDate: formData.purchaseDate ? new Date(formData.purchaseDate) : undefined,
    })
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  if (!purchase) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="w-5 h-5 text-blue-600" />
            Edit Purchase Order
          </DialogTitle>
          <DialogDescription>
            Update the purchase order details. Only basic information can be edited.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Vendor Selection */}
          <div>
            <Label htmlFor="vendor">Vendor</Label>
            <Select value={formData.vendorId} onValueChange={(value) => handleInputChange('vendorId', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select vendor" />
              </SelectTrigger>
              <ScrollableSelectContent maxHeight="200px">
                {vendors.map((vendor: any) => (
                  <SelectItem key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </SelectItem>
                ))}
              </ScrollableSelectContent>
            </Select>
          </div>

          {/* Purchase Date */}
          <div>
            <Label htmlFor="purchaseDate">Purchase Date</Label>
            <Input
              id="purchaseDate"
              type="date"
              value={formData.purchaseDate}
              onChange={(e) => handleInputChange('purchaseDate', e.target.value)}
            />
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Input
              id="notes"
              type="text"
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Additional notes (optional)"
            />
          </div>

          {/* Current Items Display */}
          <div>
            <Label>Current Items</Label>
            <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded border">
              {purchase.itemsSummary || 'No items'}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Note: Item details cannot be edited. To modify items, create a new purchase order.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updatePurchase.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updatePurchase.isPending}
            >
              {updatePurchase.isPending ? "Updating..." : "Update Purchase"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function RecentPurchases() {
  const [notifications, setNotifications] = useState<NotificationType[]>([])
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; purchaseId: string | null }>({ show: false, purchaseId: null })
  const [editPurchase, setEditPurchase] = useState<{ show: boolean; purchase: any | null }>({ show: false, purchase: null })
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null)

  // Search and pagination state
  const [searchFilters, setSearchFilters] = useState({
    vendorId: 'all',
    startDate: '',
    endDate: '',
  })
  const [currentPage, setCurrentPage] = useState(0)
  const [sortBy, setSortBy] = useState<'purchaseDate' | 'vendorName' | 'totalCost' | 'createdAt'>('purchaseDate')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const pageSize = 20

  const utils = trpc.useUtils()
  const { data: purchaseData, isLoading, error, refetch } = trpc.purchase.list.useQuery({
    vendorId: searchFilters.vendorId !== 'all' ? searchFilters.vendorId : undefined,
    startDate: searchFilters.startDate ? new Date(searchFilters.startDate) : undefined,
    endDate: searchFilters.endDate ? new Date(searchFilters.endDate) : undefined,
    limit: pageSize,
    offset: currentPage * pageSize,
    sortBy,
    sortOrder,
  })

  // Get vendors for the search filter
  const { data: vendorData } = trpc.vendor.list.useQuery()
  const vendors = vendorData?.vendors || []

  // Refetch data when the component mounts (tab becomes active)
  useEffect(() => {
    refetch()
  }, [refetch])

  // Reset page when search filters change
  useEffect(() => {
    setCurrentPage(0)
  }, [searchFilters, sortBy, sortOrder])
  const deletePurchase = trpc.purchase.delete.useMutation({
    onSuccess: async () => {
      // Invalidate and refetch purchase list
      await utils.purchase.list.invalidate()
      addNotification('success', 'Purchase Deleted', 'Purchase order has been successfully deleted')
      setDeleteConfirm({ show: false, purchaseId: null })
    },
    onError: (error) => {
      addNotification('error', 'Delete Failed', error?.message || 'Failed to delete purchase order')
      console.error('Failed to delete purchase:', error)
    }
  })

  // PDF generation mutation
  const generatePurchaseOrderPdf = trpc.pdfReports.generatePurchaseOrderPdf.useMutation({
    onSuccess: (result) => {
      if (result.success && result.data) {
        const blob = base64ToBlob(result.data, result.contentType)
        downloadBlob(blob, result.filename)
        addNotification('success', 'PDF Generated', 'Purchase order PDF has been downloaded')
      }
      setGeneratingPdf(null)
    },
    onError: (error) => {
      console.error('Failed to generate PDF:', error)
      addNotification('error', 'PDF Generation Failed', 'Failed to generate purchase order PDF. Please try again.')
      setGeneratingPdf(null)
    }
  })

  const handleGeneratePdf = (purchaseId: string) => {
    setGeneratingPdf(purchaseId)
    generatePurchaseOrderPdf.mutate({ purchaseId })
  }

  const purchases = purchaseData?.purchases || []
  const pagination = purchaseData?.pagination || { total: 0, limit: pageSize, offset: 0, hasMore: false }

  const handleSearchChange = (field: string, value: string) => {
    setSearchFilters(prev => ({ ...prev, [field]: value }))
  }

  const clearFilters = () => {
    setSearchFilters({ vendorId: 'all', startDate: '', endDate: '' })
    setSortBy('purchaseDate')
    setSortOrder('desc')
  }

  const totalPages = Math.ceil(pagination.total / pageSize)
  const canGoPrevious = currentPage > 0
  const canGoNext = pagination.hasMore

  // Notification helper functions
  const addNotification = (type: 'success' | 'error', title: string, message: string) => {
    const id = Date.now()
    const notification = { id, type, title, message }
    setNotifications(prev => [...prev, notification])

    // Auto dismiss after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id))
    }, 5000)
  }

  const removeNotification = (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const handleEditPurchase = (purchaseId: string) => {
    const purchase = purchases.find(p => p.id === purchaseId)
    if (purchase) {
      setEditPurchase({ show: true, purchase })
    }
  }

  const handleDeletePurchase = (purchaseId: string) => {
    setDeleteConfirm({ show: true, purchaseId })
  }

  const confirmDelete = () => {
    if (!deleteConfirm.purchaseId) return
    deletePurchase.mutate({ id: deleteConfirm.purchaseId })
  }

  return (
    <>
      {/* Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`
              min-w-80 max-w-md p-4 rounded-lg shadow-lg border
              ${notification.type === 'success'
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-red-50 border-red-200 text-red-800'
              }
              transform transition-all duration-300 ease-in-out
            `}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start">
                <div className="flex-shrink-0 mr-3">
                  {notification.type === 'success' ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600" />
                  )}
                </div>
                <div>
                  <h4 className="font-medium text-sm">{notification.title}</h4>
                  <p className="text-sm mt-1 opacity-90">{notification.message}</p>
                </div>
              </div>
              <button
                onClick={() => removeNotification(notification.id)}
                className="flex-shrink-0 ml-3 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-purple-600" />
                Recent Purchases
              </CardTitle>
              <CardDescription>
                {pagination.total > 0
                  ? `Showing ${currentPage * pageSize + 1}-${Math.min((currentPage + 1) * pageSize, pagination.total)} of ${pagination.total} purchase orders`
                  : 'No purchase orders found'
                }
              </CardDescription>
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                disabled={searchFilters.vendorId === 'all' && !searchFilters.startDate && !searchFilters.endDate}
              >
                <X className="w-4 h-4 mr-2" />
                Clear
              </Button>
            </div>
          </div>

          {/* Search and Filter Controls */}
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Vendor Filter */}
              <div>
                <Label htmlFor="vendor-filter">Vendor</Label>
                <Select
                  value={searchFilters.vendorId}
                  onValueChange={(value) => handleSearchChange('vendorId', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All vendors" />
                  </SelectTrigger>
                  <ScrollableSelectContent maxHeight="200px">
                    <SelectItem value="all">All vendors</SelectItem>
                    {vendors.map((vendor) => (
                      <SelectItem key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </SelectItem>
                    ))}
                  </ScrollableSelectContent>
                </Select>
              </div>

              {/* Start Date Filter */}
              <div>
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={searchFilters.startDate}
                  onChange={(e) => handleSearchChange('startDate', e.target.value)}
                />
              </div>

              {/* End Date Filter */}
              <div>
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={searchFilters.endDate}
                  onChange={(e) => handleSearchChange('endDate', e.target.value)}
                />
              </div>

              {/* Sort Options */}
              <div>
                <Label htmlFor="sort-by">Sort By</Label>
                <Select
                  value={`${sortBy}-${sortOrder}`}
                  onValueChange={(value) => {
                    const [field, order] = value.split('-') as [typeof sortBy, typeof sortOrder]
                    setSortBy(field)
                    setSortOrder(order)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="purchaseDate-desc">Date (Newest)</SelectItem>
                    <SelectItem value="purchaseDate-asc">Date (Oldest)</SelectItem>
                    <SelectItem value="vendorName-asc">Vendor (A-Z)</SelectItem>
                    <SelectItem value="vendorName-desc">Vendor (Z-A)</SelectItem>
                    <SelectItem value="totalCost-desc">Cost (High-Low)</SelectItem>
                    <SelectItem value="totalCost-asc">Cost (Low-High)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
      <CardContent>
        {/* Desktop Table */}
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    Loading purchases...
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-red-600">
                    Error loading purchases: {error.message}
                  </TableCell>
                </TableRow>
              ) : purchases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    No purchase orders found
                  </TableCell>
                </TableRow>
              ) : (
                purchases.map((purchase) => (
                  <TableRow key={purchase.id}>
                    <TableCell>{purchase.vendorName || 'Unknown Vendor'}</TableCell>
                    <TableCell>
                      {new Date(purchase.purchaseDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit'
                      })}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {purchase.itemsSummary || `${purchase.itemCount} item(s)`}
                    </TableCell>
                    <TableCell className="font-semibold text-green-600">
                      ${purchase.totalCost ? parseFloat(purchase.totalCost.toString()).toFixed(2) : '0.00'}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                        Complete
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleGeneratePdf(purchase.id)}
                          disabled={generatingPdf === purchase.id}
                          className="text-blue-600 hover:text-blue-700 hover:border-blue-300"
                          title="Export PDF"
                        >
                          {generatingPdf === purchase.id ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditPurchase(purchase.id)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeletePurchase(purchase.id)}
                          className="text-red-600 hover:text-red-700 hover:border-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="text-gray-500">Loading purchases...</div>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-600">
              Error loading purchases: {error.message}
            </div>
          ) : purchases.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No purchase orders found
            </div>
          ) : (
            <div className="space-y-4">
              {purchases.map((purchase) => (
                <Card key={purchase.id} className="border border-gray-200">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{purchase.vendorName || 'Unknown Vendor'}</h3>
                        <p className="text-sm text-gray-600">
                          {new Date(purchase.purchaseDate).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </p>
                        <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 mt-1">
                          Complete
                        </span>
                      </div>
                      <div className="text-right ml-4">
                        <div className="text-lg font-semibold text-green-600">
                          ${purchase.totalCost ? parseFloat(purchase.totalCost.toString()).toFixed(2) : '0.00'}
                        </div>
                      </div>
                    </div>

                    <div className="text-sm text-gray-600 mb-3">
                      <div className="flex items-center">
                        <span className="font-medium w-16">Items:</span>
                        <span className="truncate">{purchase.itemsSummary || `${purchase.itemCount} item(s)`}</span>
                      </div>
                    </div>

                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleGeneratePdf(purchase.id)}
                        disabled={generatingPdf === purchase.id}
                        className="text-blue-600 hover:text-blue-700 hover:border-blue-300"
                        title="Export PDF"
                      >
                        {generatingPdf === purchase.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditPurchase(purchase.id)}
                        className="flex-1"
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeletePurchase(purchase.id)}
                        className="text-red-600 hover:text-red-700 hover:border-red-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Pagination Controls */}
        {pagination.total > 0 && (
          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Showing {currentPage * pageSize + 1}-{Math.min((currentPage + 1) * pageSize, pagination.total)} of {pagination.total} results
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(0)}
                disabled={!canGoPrevious}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                First
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={!canGoPrevious}
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </Button>
              <span className="text-sm text-gray-600 px-2">
                Page {currentPage + 1} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={!canGoNext}
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(totalPages - 1)}
                disabled={!canGoNext}
              >
                Last
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirm.show} onOpenChange={(open) => !open && setDeleteConfirm({ show: false, purchaseId: null })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-600" />
              Delete Purchase Order
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this purchase order? This action cannot be undone and will remove all associated data.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirm({ show: false, purchaseId: null })}
              disabled={deletePurchase.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deletePurchase.isPending}
            >
              {deletePurchase.isPending ? "Deleting..." : "Delete Purchase"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Purchase Dialog */}
      <EditPurchaseDialog
        open={editPurchase.show}
        onOpenChange={(open) => !open && setEditPurchase({ show: false, purchase: null })}
        purchase={editPurchase.purchase}
        onSuccess={() => {
          setEditPurchase({ show: false, purchase: null })
          addNotification('success', 'Purchase Updated', 'Purchase order has been successfully updated')
        }}
        onError={(error) => {
          addNotification('error', 'Update Failed', error || 'Failed to update purchase order')
        }}
      />
    </>
  )
}

function VendorVarietiesManagement() {
  const [selectedVendorId, setSelectedVendorId] = useState<string>("")

  // Get all vendors for selection
  const { data: vendorsData, isLoading: vendorsLoading } = trpc.vendor.list.useQuery()
  const vendors = vendorsData?.vendors || []

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Apple className="w-5 h-5 text-green-600" />
          Vendor Variety Management
        </CardTitle>
        <CardDescription>
          Manage which apple varieties each vendor can supply. Add new varieties and link them to vendors.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Vendor Selection */}
        <div>
          <Label htmlFor="vendor-select">Select Vendor</Label>
          <Select value={selectedVendorId} onValueChange={setSelectedVendorId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a vendor to manage their varieties..." />
            </SelectTrigger>
            <ScrollableSelectContent maxHeight="200px">
              {vendors?.map((vendor) => (
                <SelectItem key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </SelectItem>
              ))}
            </ScrollableSelectContent>
          </Select>
        </div>

        {/* Vendor Varieties Panel - reuse existing component */}
        {selectedVendorId && (
          <div className="border-t pt-6">
            <VendorVarietiesPanel
              vendor={vendors.find(v => v.id === selectedVendorId) || { id: selectedVendorId, name: "Unknown Vendor" }}
            />
          </div>
        )}

        {/* Instructions when no vendor selected */}
        {!selectedVendorId && (
          <div className="text-center py-8 text-gray-500">
            <Apple className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">Select a vendor to manage their apple varieties</p>
            <p className="text-sm">You can add new varieties, link existing ones, or remove varieties from the selected vendor.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function PurchasingPage() {
  const [activeTab, setActiveTab] = useState<"purchase" | "vendors" | "history" | "vendor-varieties">("purchase")
  const [preSelectedVendorId, setPreSelectedVendorId] = useState<string | null>(null)

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
        <div className="flex flex-col sm:flex-row sm:space-x-1 mb-6 sm:mb-8 bg-gray-100 p-1 rounded-lg w-full sm:w-fit">
          {[
            { key: "purchase", label: "New Purchase", icon: ShoppingCart },
            { key: "vendors", label: "Vendors", icon: Building2 },
            { key: "vendor-varieties", label: "Vendor Varieties", icon: Apple },
            { key: "history", label: "Purchase History", icon: Receipt },
          ].map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex items-center justify-center sm:justify-start px-2 sm:px-4 py-2 rounded-md text-sm font-medium transition-colors flex-1 sm:flex-none ${
                  activeTab === tab.key
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <Icon className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline ml-2 sm:ml-0">{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* Tab Content */}
        <div className="space-y-8">
          {activeTab === "vendors" && <VendorManagement preSelectedVendorId={preSelectedVendorId} />}
          {activeTab === "purchase" && <PurchaseFormComponent setPreSelectedVendorId={setPreSelectedVendorId} setActiveTab={setActiveTab} />}
          {activeTab === "vendor-varieties" && <VendorVarietiesManagement />}
          {activeTab === "history" && <RecentPurchases />}
        </div>
      </main>
    </div>
  )
}