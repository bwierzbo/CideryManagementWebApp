"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Plus,
  Edit,
  Trash2,
  Package,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { trpc } from "@/utils/trpc"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { packagingItemTypeSchema } from "lib"

const varietySchema = z.object({
  name: z.string().min(1, "Name is required"),
  itemType: packagingItemTypeSchema,
})

// Extract the enum values for the dropdown
const packagingItemTypes = packagingItemTypeSchema.options

type VarietyForm = z.infer<typeof varietySchema>

export function PackagingVarietyManagement() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingVariety, setEditingVariety] = useState<any>(null)

  // Search and pagination state
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Calculate pagination offset
  const offset = (currentPage - 1) * itemsPerPage

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery])

  const queryInput = React.useMemo(() => {
    return {
      search: debouncedSearchQuery || undefined,
      limit: itemsPerPage,
      offset: offset,
      sortBy: 'name' as const,
      sortOrder: 'asc' as const,
      includeInactive: false,
    }
  }, [debouncedSearchQuery, itemsPerPage, offset])

  const { data: varietyData, refetch: refetchVarieties, isLoading } = trpc.packagingVarieties.list.useQuery(queryInput)

  const varieties = React.useMemo(() => varietyData?.varieties || [], [varietyData])
  const pagination = varietyData?.pagination

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearchQuery])

  const createVariety = trpc.packagingVarieties.create.useMutation({
    onSuccess: () => {
      refetchVarieties()
      setIsAddDialogOpen(false)
      reset()
    }
  })

  const updateVariety = trpc.packagingVarieties.update.useMutation({
    onSuccess: () => {
      refetchVarieties()
      setIsEditDialogOpen(false)
      setEditingVariety(null)
      reset()
    }
  })

  const deleteVariety = trpc.packagingVarieties.delete.useMutation({
    onSuccess: () => refetchVarieties()
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    control
  } = useForm<VarietyForm>({
    resolver: zodResolver(varietySchema)
  })

  const onSubmit = (data: VarietyForm) => {
    if (editingVariety) {
      updateVariety.mutate({ ...data, id: editingVariety.id, isActive: true })
    } else {
      createVariety.mutate(data)
    }
  }

  const handleEdit = (variety: any) => {
    setEditingVariety(variety)
    reset({
      name: variety.name,
      itemType: variety.itemType,
    })
    setIsEditDialogOpen(true)
  }

  const handleAddNew = () => {
    setEditingVariety(null)
    reset()
    setIsAddDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsAddDialogOpen(false)
    setIsEditDialogOpen(false)
    setEditingVariety(null)
    reset()
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-orange-600" />
              Packaging Varieties
            </CardTitle>
            <CardDescription>Manage packaging types and varieties for your cidery</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={isAddDialogOpen || isEditDialogOpen} onOpenChange={(open) => {
              if (!open) handleCloseDialog()
            }}>
              <DialogTrigger asChild>
                <Button onClick={handleAddNew}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Packaging
                </Button>
              </DialogTrigger>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search packaging varieties by name or type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <Dialog open={isAddDialogOpen || isEditDialogOpen} onOpenChange={(open) => {
          if (!open) handleCloseDialog()
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingVariety ? 'Edit Packaging Variety' : 'Add New Packaging Variety'}</DialogTitle>
              <DialogDescription>
                {editingVariety
                  ? 'Update packaging variety information.'
                  : 'Create a new packaging variety to track in purchases.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  {...register("name")}
                  placeholder="e.g., 750ml Glass Bottles, Crown Caps"
                />
                {errors.name && <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>}
              </div>
              <div>
                <Label htmlFor="itemType">Item Type</Label>
                <Controller
                  name="itemType"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value || ''} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select item type..." />
                      </SelectTrigger>
                      <SelectContent>
                        {packagingItemTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.itemType && <p className="text-sm text-red-600 mt-1">{errors.itemType.message}</p>}
              </div>
              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createVariety.isPending || updateVariety.isPending}>
                  {editingVariety
                    ? (updateVariety.isPending ? "Updating..." : "Update Variety")
                    : (createVariety.isPending ? "Creating..." : "Create Variety")
                  }
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Loading state */}
        {isLoading && (
          <div className="flex justify-center py-8">
            <div className="text-gray-500">Loading packaging varieties...</div>
          </div>
        )}

        {/* No results state */}
        {!isLoading && varieties.length === 0 && (
          <div className="text-center py-8">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchQuery ? 'No packaging varieties found' : 'No packaging varieties yet'}
            </h3>
            <p className="text-gray-500">
              {searchQuery
                ? `No packaging varieties match "${searchQuery}". Try a different search term.`
                : 'Start by adding your first packaging variety to track in purchases.'
              }
            </p>
          </div>
        )}

        {/* Desktop Table */}
        {!isLoading && varieties.length > 0 && (
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Item Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {varieties.map((variety: any) => (
                  <TableRow key={variety.id} className="hover:bg-gray-50">
                    <TableCell className="font-medium">{variety.name}</TableCell>
                    <TableCell>{variety.itemType}</TableCell>
                    <TableCell>
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        variety.isActive
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}>
                        {variety.isActive ? "Active" : "Inactive"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(variety)}
                          title="Edit variety"
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteVariety.mutate({ id: variety.id })}
                          title="Delete variety"
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
        )}

        {/* Mobile Cards */}
        {!isLoading && varieties.length > 0 && (
          <div className="md:hidden space-y-4">
            {varieties.map((variety: any) => (
              <Card key={variety.id} className="border border-gray-200">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{variety.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{variety.itemType}</p>
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full mt-2 ${
                        variety.isActive
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}>
                        {variety.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <div className="flex space-x-2 ml-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(variety)}
                        title="Edit variety"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deleteVariety.mutate({ id: variety.id })}
                        title="Delete variety"
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination Controls */}
        {pagination && pagination.total > itemsPerPage && (
          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing {pagination.offset + 1} to {Math.min(pagination.offset + pagination.limit, pagination.total)} of {pagination.total} varieties
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>
              <span className="text-sm text-gray-700">
                Page {currentPage} of {Math.ceil(pagination.total / itemsPerPage)}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={!pagination.hasMore}
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}