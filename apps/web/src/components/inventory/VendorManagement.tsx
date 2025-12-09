"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Plus,
  Edit,
  Trash2,
  Building2,
  ExternalLink,
  Apple,
  Search,
  ChevronLeft,
  ChevronRight,
  Link2,
} from "lucide-react";
import { trpc } from "@/utils/trpc";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { VendorVarietyLinkModal } from "./VendorVarietyLinkModal";

// Form schema for vendor management
const vendorSchema = z.object({
  name: z.string().min(1, "Name is required"),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().optional(),
  address: z.string().optional(),
});

type VendorForm = z.infer<typeof vendorSchema>;

interface VendorManagementProps {
  preSelectedVendorId?: string | null;
  onVendorSelect?: (vendorId: string) => void;
}

export function VendorManagement({
  preSelectedVendorId,
  onVendorSelect,
}: VendorManagementProps) {
  const { data: session } = useSession();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<any>(null);
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [varietyModalVendor, setVarietyModalVendor] = useState<any>(null);
  const [isVarietyModalOpen, setIsVarietyModalOpen] = useState(false);

  // Search and pagination state
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Calculate pagination offset
  const offset = (currentPage - 1) * itemsPerPage;

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const queryInput = React.useMemo(() => {
    const trimmedSearch = debouncedSearchQuery.trim();
    const input = {
      search: trimmedSearch || undefined,
      limit: itemsPerPage,
      offset: offset,
      sortBy: "name" as const,
      sortOrder: "asc" as const,
      includeInactive: false,
    };

    console.log("Frontend query input:", input);
    return input;
  }, [debouncedSearchQuery, itemsPerPage, offset]);

  const {
    data: vendorData,
    refetch: refetchVendors,
    isLoading,
  } = trpc.vendor.list.useQuery(queryInput);

  const vendors = React.useMemo(() => vendorData?.vendors || [], [vendorData]);
  const pagination = vendorData?.pagination;

  console.log(
    "VendorManagement - vendors count:",
    vendors.length,
    "pagination:",
    pagination,
    "itemsPerPage:",
    itemsPerPage,
  );

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery]);

  // Handle pre-selected vendor
  React.useEffect(() => {
    if (preSelectedVendorId && vendors.length > 0) {
      const vendor = vendors.find((v) => v.id === preSelectedVendorId);
      if (vendor) {
        setSelectedVendor(vendor);
      }
    }
  }, [preSelectedVendorId, vendors]);

  const createVendor = trpc.vendor.create.useMutation({
    onSuccess: () => {
      refetchVendors();
      setIsAddDialogOpen(false);
      reset();
    },
  });

  const updateVendor = trpc.vendor.update.useMutation({
    onSuccess: () => {
      refetchVendors();
      setIsEditDialogOpen(false);
      setEditingVendor(null);
      reset();
    },
  });

  const deleteVendor = trpc.vendor.delete.useMutation({
    onSuccess: () => refetchVendors(),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<VendorForm>({
    resolver: zodResolver(vendorSchema),
  });

  const onSubmit = (data: VendorForm) => {
    if (editingVendor) {
      updateVendor.mutate({ ...data, id: editingVendor.id });
    } else {
      createVendor.mutate(data);
    }
  };

  const handleEdit = (vendor: any) => {
    setEditingVendor(vendor);
    // Pre-populate the form with vendor data
    reset({
      name: vendor.name,
      contactEmail: vendor.contactInfo?.email || "",
      contactPhone: vendor.contactInfo?.phone || "",
      address: vendor.contactInfo?.address || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleAddNew = () => {
    setEditingVendor(null);
    reset();
    setIsAddDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsAddDialogOpen(false);
    setIsEditDialogOpen(false);
    setEditingVendor(null);
    reset();
  };

  const handleVendorClick = (vendor: any) => {
    setSelectedVendor(vendor);
    onVendorSelect?.(vendor.id);
  };

  const handleOpenVarietyModal = (vendor: any) => {
    setVarietyModalVendor(vendor);
    setIsVarietyModalOpen(true);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              Vendors
            </CardTitle>
            <CardDescription>
              Manage your base fruit suppliers and vendors
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Dialog
              open={isAddDialogOpen || isEditDialogOpen}
              onOpenChange={(open) => {
                if (!open) handleCloseDialog();
              }}
            >
              <DialogTrigger asChild>
                <Button onClick={handleAddNew}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Vendor
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
              placeholder="Search vendors by name, email, phone, or address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Dialog
          open={isAddDialogOpen || isEditDialogOpen}
          onOpenChange={(open) => {
            if (!open) handleCloseDialog();
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingVendor ? "Edit Vendor" : "Add New Vendor"}
              </DialogTitle>
              <DialogDescription>
                {editingVendor
                  ? "Update vendor information and contact details."
                  : "Create a new vendor to track base fruit purchases from."}
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
                {errors.name && (
                  <p className="text-sm text-red-600 mt-1">
                    {errors.name.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="contactEmail">Contact Email</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  {...register("contactEmail")}
                  placeholder="contact@vendor.com"
                />
                {errors.contactEmail && (
                  <p className="text-sm text-red-600 mt-1">
                    {errors.contactEmail.message}
                  </p>
                )}
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
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseDialog}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createVendor.isPending || updateVendor.isPending}
                >
                  {editingVendor
                    ? updateVendor.isPending
                      ? "Updating..."
                      : "Update Vendor"
                    : createVendor.isPending
                      ? "Creating..."
                      : "Create Vendor"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Loading state */}
        {isLoading && (
          <div className="flex justify-center py-8">
            <div className="text-gray-500">Loading vendors...</div>
          </div>
        )}

        {/* No results state */}
        {!isLoading && vendors.length === 0 && (
          <div className="text-center py-8">
            <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchQuery ? "No vendors found" : "No vendors yet"}
            </h3>
            <p className="text-gray-500">
              {searchQuery
                ? `No vendors match "${searchQuery}". Try a different search term.`
                : "Start by adding your first vendor to track base fruit purchases."}
            </p>
          </div>
        )}
      </CardContent>

      {!isLoading && vendors.length > 0 && (
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
                  <TableHead className="w-[140px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendors.map((vendor: any) => (
                  <TableRow
                    key={vendor.id}
                    className={`cursor-pointer hover:bg-gray-50 ${
                      selectedVendor?.id === vendor.id
                        ? "bg-blue-50 border-l-4 border-l-blue-500"
                        : ""
                    }`}
                    onClick={() => handleVendorClick(vendor)}
                  >
                    <TableCell className="font-medium">{vendor.name}</TableCell>
                    <TableCell>{vendor.contactInfo?.email || "—"}</TableCell>
                    <TableCell>{vendor.contactInfo?.phone || "—"}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          vendor.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {vendor.isActive ? "Active" : "Inactive"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenVarietyModal(vendor);
                          }}
                          title="Manage varieties"
                        >
                          <Link2 className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(vendor);
                          }}
                          title="Edit vendor"
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteVendor.mutate({ id: vendor.id });
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
                  selectedVendor?.id === vendor.id
                    ? "border-blue-500 bg-blue-50"
                    : ""
                }`}
                onClick={() => handleVendorClick(vendor)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">
                        {vendor.name}
                      </h3>
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full mt-1 ${
                          vendor.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {vendor.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <div className="flex space-x-2 ml-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenVarietyModal(vendor);
                        }}
                        title="Manage varieties"
                      >
                        <Link2 className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(vendor);
                        }}
                        title="Edit vendor"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteVendor.mutate({ id: vendor.id });
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

          {/* Pagination Controls */}
          {pagination &&
            (pagination.total > itemsPerPage || vendors.length > 0) && (
              <div className="mt-6 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Showing {pagination.offset + 1} to{" "}
                  {Math.min(
                    pagination.offset + pagination.limit,
                    pagination.total,
                  )}{" "}
                  of {pagination.total} vendors
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
                    Page {currentPage} of{" "}
                    {Math.ceil(pagination.total / itemsPerPage)}
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
      )}

      {/* Vendor Variety Link Modal */}
      {varietyModalVendor && (
        <VendorVarietyLinkModal
          vendor={varietyModalVendor}
          open={isVarietyModalOpen}
          onOpenChange={(open) => {
            setIsVarietyModalOpen(open);
            if (!open) {
              setVarietyModalVendor(null);
            }
          }}
        />
      )}
    </Card>
  );
}
