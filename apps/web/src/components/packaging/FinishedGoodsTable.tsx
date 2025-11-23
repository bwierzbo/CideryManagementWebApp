"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Package,
  MoreVertical,
  Send,
  Edit,
  TrendingUp,
  Search,
  Wine,
} from "lucide-react";
import { trpc } from "@/utils/trpc";
import { useToast } from "@/hooks/use-toast";
import { DistributeInventoryModal } from "./DistributeInventoryModal";
import { AdjustInventoryModal } from "./AdjustInventoryModal";
import { UpdatePricingModal } from "./UpdatePricingModal";

interface FinishedGoodsTableProps {
  className?: string;
  itemsPerPage?: number;
}

export function FinishedGoodsTable({
  className,
  itemsPerPage = 50,
}: FinishedGoodsTableProps) {
  const { toast } = useToast();
  const router = useRouter();

  // Search and pagination state
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(0);

  // Modal state
  const [distributeModalOpen, setDistributeModalOpen] = useState(false);
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [pricingModalOpen, setPricingModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);

  // Fetch finished goods
  const { data, isLoading, refetch } = trpc.inventory.listFinishedGoods.useQuery({
    limit: itemsPerPage,
    offset: currentPage * itemsPerPage,
    search: searchTerm,
    status: "in_stock",
  });

  const utils = trpc.useContext();

  // Format currency
  const formatCurrency = (amount: string | null) => {
    if (!amount) return "-";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(parseFloat(amount));
  };

  // Format package type
  const formatPackageType = (type: string, sizeML: number | null) => {
    if (!sizeML) return type;
    // Format as "750ml glass bottle" style
    if (sizeML >= 1000) {
      const liters = (sizeML / 1000).toFixed(1).replace(/\.0$/, '');
      return `${liters}L ${type}`;
    }
    return `${sizeML}ml ${type}`;
  };

  // Handle distribute action
  const handleDistribute = (item: any) => {
    setSelectedItem(item);
    setDistributeModalOpen(true);
  };

  // Handle adjust inventory action
  const handleAdjustInventory = (item: any) => {
    setSelectedItem(item);
    setAdjustModalOpen(true);
  };

  // Handle update pricing action
  const handleUpdatePricing = (item: any) => {
    setSelectedItem(item);
    setPricingModalOpen(true);
  };

  // Handle successful actions
  const handleActionSuccess = () => {
    refetch();
    utils.inventory.listFinishedGoods.invalidate();
    setSelectedItem(null);
  };

  // Handle row click to view details
  const handleRowClick = (item: any) => {
    if (item.bottleRunId) {
      router.push(`/packaging/${item.bottleRunId}`);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const items = data?.items || [];
  const pagination = data?.pagination;

  return (
    <div className={className}>
      {/* Header with Search */}
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search cider names..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(0);
              }}
              className="pl-10"
            />
          </div>
        </div>
        <div className="text-sm text-gray-600">
          {pagination && (
            <span>
              Showing {pagination.offset + 1}-
              {Math.min(pagination.offset + pagination.limit, pagination.total)} of{" "}
              {pagination.total}
            </span>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Cider Name</TableHead>
              <TableHead>Package</TableHead>
              <TableHead className="text-right">Available</TableHead>
              <TableHead className="text-right">Retail Price</TableHead>
              <TableHead className="text-right">Wholesale Price</TableHead>
              <TableHead>Expiration</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  <Wine className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                  <p className="font-medium">No finished goods in inventory</p>
                  <p className="text-sm mt-1">
                    Complete packaging runs to create inventory items
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow
                  key={item.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleRowClick(item)}
                >
                  {/* Product Name (Custom Name or Batch Name) */}
                  <TableCell className="font-medium">
                    {item.batchCustomName || item.batchName || item.lotCode || "Unknown Cider"}
                  </TableCell>

                  {/* Package Type */}
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-xs">
                      {formatPackageType(
                        item.packageType || "bottle",
                        item.packageSizeML,
                      )}
                    </Badge>
                  </TableCell>

                  {/* Available Quantity */}
                  <TableCell className="text-right">
                    <span
                      className={`font-semibold ${
                        (item.currentQuantity || 0) === 0
                          ? "text-red-600"
                          : (item.currentQuantity || 0) < 50
                            ? "text-yellow-600"
                            : "text-green-600"
                      }`}
                    >
                      {(item.currentQuantity || 0).toLocaleString()}
                    </span>
                  </TableCell>

                  {/* Retail Price */}
                  <TableCell className="text-right font-mono text-sm">
                    {formatCurrency(item.retailPrice)}
                  </TableCell>

                  {/* Wholesale Price */}
                  <TableCell className="text-right font-mono text-sm">
                    {formatCurrency(item.wholesalePrice)}
                  </TableCell>

                  {/* Location - Show expiration date instead */}
                  <TableCell>
                    {item.expirationDate ? (
                      <Badge variant="secondary" className="text-xs">
                        Exp: {new Date(item.expirationDate).toLocaleDateString()}
                      </Badge>
                    ) : (
                      <span className="text-gray-400 text-xs">No expiration</span>
                    )}
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDistribute(item);
                          }}
                          disabled={(item.currentQuantity || 0) === 0}
                        >
                          <Send className="mr-2 h-4 w-4" />
                          Distribute
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAdjustInventory(item);
                          }}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Adjust Inventory
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdatePricing(item);
                          }}
                        >
                          <TrendingUp className="mr-2 h-4 w-4" />
                          Update Pricing
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination && pagination.total > itemsPerPage && (
        <div className="mt-4 flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
            disabled={currentPage === 0}
          >
            Previous
          </Button>
          <span className="text-sm text-gray-600">
            Page {currentPage + 1} of {Math.ceil(pagination.total / itemsPerPage)}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => p + 1)}
            disabled={!pagination.hasMore}
          >
            Next
          </Button>
        </div>
      )}

      {/* Distribute Modal */}
      {selectedItem && (
        <DistributeInventoryModal
          open={distributeModalOpen}
          onClose={() => {
            setDistributeModalOpen(false);
            setSelectedItem(null);
          }}
          inventoryItemId={selectedItem.id}
          productName={selectedItem.batchCustomName || selectedItem.batchName || selectedItem.lotCode || "Product"}
          currentQuantity={selectedItem.currentQuantity || 0}
          suggestedPrice={
            selectedItem.retailPrice ? parseFloat(selectedItem.retailPrice) : undefined
          }
          onSuccess={handleActionSuccess}
        />
      )}

      {/* Adjust Inventory Modal */}
      {selectedItem && (
        <AdjustInventoryModal
          open={adjustModalOpen}
          onClose={() => {
            setAdjustModalOpen(false);
            setSelectedItem(null);
          }}
          inventoryItemId={selectedItem.id}
          productName={selectedItem.batchCustomName || selectedItem.batchName || selectedItem.lotCode || "Product"}
          currentQuantity={selectedItem.currentQuantity || 0}
          onSuccess={handleActionSuccess}
        />
      )}

      {/* Update Pricing Modal */}
      {selectedItem && (
        <UpdatePricingModal
          open={pricingModalOpen}
          onClose={() => {
            setPricingModalOpen(false);
            setSelectedItem(null);
          }}
          inventoryItemId={selectedItem.id}
          productName={selectedItem.batchCustomName || selectedItem.batchName || selectedItem.lotCode || "Product"}
          currentRetailPrice={selectedItem.retailPrice}
          currentWholesalePrice={selectedItem.wholesalePrice}
          onSuccess={handleActionSuccess}
        />
      )}
    </div>
  );
}
