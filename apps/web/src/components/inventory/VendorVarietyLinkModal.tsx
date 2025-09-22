"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollableContainer } from "@/components/ui/scrollable-container"
import {
  Plus,
  Apple,
  Tag,
  X,
  Link2
} from "lucide-react"
import { trpc } from "@/utils/trpc"

interface VendorVarietyLinkModalProps {
  vendor: any
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function VendorVarietyLinkModal({ vendor, open, onOpenChange }: VendorVarietyLinkModalProps) {
  const [isAddVarietyModalOpen, setIsAddVarietyModalOpen] = useState(false)

  // TODO: Replace with actual role check from session/auth
  const isAdmin = true // For now, assume all users are admin for testing

  // tRPC hooks for vendor varieties
  const { data: varietiesData, refetch: refetchVarieties } = trpc.vendorVariety.listForVendor.useQuery(
    { vendorId: vendor.id },
    { enabled: !!vendor.id && open }
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-blue-600" />
            Variety Links for {vendor.name}
          </DialogTitle>
          <DialogDescription>
            View and manage which base fruit varieties this vendor can supply
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Current Varieties Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Apple className="w-5 h-5 text-green-600" />
                    Linked Varieties ({varieties.length})
                  </CardTitle>
                  <CardDescription>
                    Base fruit varieties currently linked to this vendor
                  </CardDescription>
                </div>
                {isAdmin && (
                  <Button
                    size="sm"
                    onClick={() => setIsAddVarietyModalOpen(true)}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Variety
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {varieties.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Apple className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-lg font-medium mb-2">No varieties linked</h3>
                  <p className="text-sm mb-4">Add the first base fruit variety this vendor can supply.</p>
                  {isAdmin && (
                    <Button onClick={() => setIsAddVarietyModalOpen(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Variety
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
                            {variety.notes && (
                              <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                                {variety.notes}
                              </span>
                            )}
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
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Tag className="w-4 h-4 text-green-600" />
                                <span className="font-medium text-green-800">{variety.name}</span>
                              </div>
                              {variety.notes && (
                                <p className="text-xs text-green-600 mt-1 pl-6">{variety.notes}</p>
                              )}
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
                </div>
              )}
            </CardContent>
          </Card>

          {/* Close Button */}
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>

        {/* Add Variety Modal */}
        <Dialog open={isAddVarietyModalOpen} onOpenChange={setIsAddVarietyModalOpen}>
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
      </DialogContent>
    </Dialog>
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
          Add Base Fruit Variety
        </DialogTitle>
        <DialogDescription>
          Search for an existing variety or create a new one for {vendor.name}.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 mt-4">
        {/* Search Input */}
        <div>
          <Label htmlFor="variety-search">Base Fruit Variety</Label>
          <Input
            id="variety-search"
            placeholder="Search for base fruit varieties..."
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