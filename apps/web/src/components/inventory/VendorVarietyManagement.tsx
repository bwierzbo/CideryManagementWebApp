"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollableSelectContent } from "@/components/ui/scrollable-select"
import { ScrollableContainer } from "@/components/ui/scrollable-container"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import {
  Plus,
  Apple,
  Tag,
  X
} from "lucide-react"
import { trpc } from "@/utils/trpc"

interface VendorVarietiesPanelProps {
  vendor: any
}

function VendorVarietiesPanel({ vendor }: VendorVarietiesPanelProps) {
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
                    refetchVarieties()
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

interface VendorVarietyManagementProps {
  selectedVendorId?: string
  onVendorChange?: (vendorId: string) => void
}

export function VendorVarietyManagement({ selectedVendorId, onVendorChange }: VendorVarietyManagementProps) {
  const [localSelectedVendorId, setLocalSelectedVendorId] = useState<string>(selectedVendorId || "")

  // Get all vendors for selection
  const { data: vendorsData, isLoading: vendorsLoading } = trpc.vendor.list.useQuery()
  const vendors = vendorsData?.vendors || []

  const handleVendorChange = (vendorId: string) => {
    setLocalSelectedVendorId(vendorId)
    onVendorChange?.(vendorId)
  }

  const currentVendorId = selectedVendorId || localSelectedVendorId

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
          <Select value={currentVendorId} onValueChange={handleVendorChange}>
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
        {currentVendorId && (
          <div className="border-t pt-6">
            <VendorVarietiesPanel
              vendor={vendors.find(v => v.id === currentVendorId) || { id: currentVendorId, name: "Unknown Vendor" }}
            />
          </div>
        )}

        {/* Instructions when no vendor selected */}
        {!currentVendorId && (
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