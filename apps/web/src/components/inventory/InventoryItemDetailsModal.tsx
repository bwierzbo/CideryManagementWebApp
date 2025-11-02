"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, DollarSign, Package, TrendingUp } from "lucide-react";
import { formatDate } from "@/utils/date-format";

interface PurchaseDetail {
  purchaseId: string | null;
  purchaseDate: string | null;
  vendorName: string | null;
  quantity: number;
  pricePerUnit: number;
  totalCost: number;
}

interface InventoryItemMetadata {
  varietyName?: string;
  productName?: string;
  vendorName?: string;
  purchaseCount?: number;
  purchaseDetails?: PurchaseDetail[];
  totalQuantity?: number;
  totalCost?: number;
  averageCost?: number;
  unit?: string;
}

interface InventoryItem {
  id: string;
  currentBottleCount: number;
  reservedBottleCount: number;
  materialType?: string;
  metadata?: InventoryItemMetadata;
  createdAt: string;
  notes?: string | null;
  // Juice-specific fields
  brix?: string | null;
  ph?: string | null;
  specificGravity?: string | null;
  containerType?: string | null;
  // Additive-specific fields
  lotBatchNumber?: string | null;
  expirationDate?: string | null;
  storageRequirements?: string | null;
  brandManufacturer?: string | null;
  // Packaging-specific fields
  packageType?: string | null;
  materialType2?: string | null;
  size?: string | null;
  // Base fruit-specific fields
  harvestDate?: string | null;
}

interface InventoryItemDetailsModalProps {
  open: boolean;
  onClose: () => void;
  item: InventoryItem | null;
}

export function InventoryItemDetailsModal({
  open,
  onClose,
  item,
}: InventoryItemDetailsModalProps) {
  if (!item) return null;

  const metadata = item.metadata || {};
  const itemName = metadata.varietyName || metadata.productName || "Unknown Item";
  const unit = metadata.unit || "units";
  const purchaseDetails = metadata.purchaseDetails || [];
  const purchaseCount = metadata.purchaseCount || 1;

  // Only show the modal for consolidated items (multiple purchases)
  const isConsolidated = purchaseCount > 1;

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Format quantity with unit
  const formatQuantity = (qty: number | undefined) => {
    if (qty === undefined || qty === null) return `0 ${unit}`;
    return `${qty.toLocaleString()} ${unit}`;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold flex items-center gap-2">
            <Package className="w-5 h-5" />
            {itemName}
          </DialogTitle>
          <DialogDescription>
            {isConsolidated
              ? `Consolidated from ${purchaseCount} purchases`
              : "Single purchase item"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Total Quantity */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Total Quantity
                    </p>
                    <p className="text-2xl font-bold mt-1">
                      {formatQuantity(metadata.totalQuantity || item.currentBottleCount)}
                    </p>
                  </div>
                  <Package className="w-8 h-8 text-blue-500 opacity-20" />
                </div>
              </CardContent>
            </Card>

            {/* Total Cost */}
            {metadata.totalCost !== undefined && metadata.totalCost > 0 && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Total Cost
                      </p>
                      <p className="text-2xl font-bold mt-1">
                        {formatCurrency(metadata.totalCost)}
                      </p>
                    </div>
                    <DollarSign className="w-8 h-8 text-green-500 opacity-20" />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Weighted Average Cost */}
            {metadata.averageCost !== undefined && metadata.averageCost > 0 && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Avg Cost per {unit}
                      </p>
                      <p className="text-2xl font-bold mt-1">
                        {formatCurrency(metadata.averageCost)}
                      </p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-amber-500 opacity-20" />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Purchase Details Table */}
          {isConsolidated && purchaseDetails.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Purchase History
              </h3>
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Vendor</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Total Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchaseDetails.map((detail, index) => (
                        <TableRow key={detail.purchaseId || index}>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <Calendar className="w-3 h-3 text-muted-foreground" />
                              <span>
                                {detail.purchaseDate
                                  ? formatDate(detail.purchaseDate)
                                  : "-"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">
                              {detail.vendorName || "-"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatQuantity(detail.quantity)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {detail.pricePerUnit > 0
                              ? formatCurrency(detail.pricePerUnit)
                              : "-"}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold">
                            {detail.totalCost > 0
                              ? formatCurrency(detail.totalCost)
                              : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Single Purchase Info */}
          {!isConsolidated && purchaseDetails.length === 1 && (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-muted-foreground">
                      Vendor
                    </span>
                    <span className="text-sm font-semibold">
                      {purchaseDetails[0].vendorName || "-"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-muted-foreground">
                      Purchase Date
                    </span>
                    <span className="text-sm font-semibold">
                      {purchaseDetails[0].purchaseDate
                        ? formatDate(purchaseDetails[0].purchaseDate)
                        : "-"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-muted-foreground">
                      Quantity
                    </span>
                    <span className="text-sm font-semibold">
                      {formatQuantity(purchaseDetails[0].quantity)}
                    </span>
                  </div>
                  {purchaseDetails[0].pricePerUnit > 0 && (
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-muted-foreground">
                        Unit Price
                      </span>
                      <span className="text-sm font-semibold">
                        {formatCurrency(purchaseDetails[0].pricePerUnit)}
                      </span>
                    </div>
                  )}
                  {purchaseDetails[0].totalCost > 0 && (
                    <div className="flex justify-between pt-3 border-t">
                      <span className="text-sm font-medium text-muted-foreground">
                        Total Cost
                      </span>
                      <span className="text-lg font-bold">
                        {formatCurrency(purchaseDetails[0].totalCost)}
                      </span>
                    </div>
                  )}

                  {/* Material-specific fields */}
                  {item.materialType === "juice" && (
                    <>
                      {(item.ph || metadata.ph) && (
                        <div className="flex justify-between pt-3 border-t">
                          <span className="text-sm font-medium text-muted-foreground">
                            pH
                          </span>
                          <span className="text-sm font-semibold">
                            {item.ph || metadata.ph}
                          </span>
                        </div>
                      )}
                      {(item.specificGravity || metadata.specificGravity) && (
                        <div className="flex justify-between">
                          <span className="text-sm font-medium text-muted-foreground">
                            Specific Gravity (SG)
                          </span>
                          <span className="text-sm font-semibold">
                            {parseFloat(item.specificGravity || metadata.specificGravity).toFixed(3)}
                          </span>
                        </div>
                      )}
                      {(item.brix || metadata.brix) && (
                        <div className="flex justify-between">
                          <span className="text-sm font-medium text-muted-foreground">
                            Brix
                          </span>
                          <span className="text-sm font-semibold">
                            {item.brix || metadata.brix}°
                          </span>
                        </div>
                      )}
                      {(item.containerType || metadata.containerType) && (
                        <div className="flex justify-between">
                          <span className="text-sm font-medium text-muted-foreground">
                            Container Type
                          </span>
                          <span className="text-sm font-semibold capitalize">
                            {item.containerType || metadata.containerType}
                          </span>
                        </div>
                      )}
                    </>
                  )}

                  {item.materialType === "additives" && (
                    <>
                      {item.brandManufacturer && (
                        <div className="flex justify-between pt-3 border-t">
                          <span className="text-sm font-medium text-muted-foreground">
                            Brand/Manufacturer
                          </span>
                          <span className="text-sm font-semibold">
                            {item.brandManufacturer}
                          </span>
                        </div>
                      )}
                      {item.lotBatchNumber && (
                        <div className="flex justify-between">
                          <span className="text-sm font-medium text-muted-foreground">
                            Lot/Batch Number
                          </span>
                          <span className="text-sm font-semibold">
                            {item.lotBatchNumber}
                          </span>
                        </div>
                      )}
                      {item.expirationDate && (
                        <div className="flex justify-between">
                          <span className="text-sm font-medium text-muted-foreground">
                            Expiration Date
                          </span>
                          <span className="text-sm font-semibold">
                            {formatDate(item.expirationDate)}
                          </span>
                        </div>
                      )}
                      {item.storageRequirements && (
                        <div className="flex justify-between">
                          <span className="text-sm font-medium text-muted-foreground">
                            Storage Requirements
                          </span>
                          <span className="text-sm font-semibold">
                            {item.storageRequirements}
                          </span>
                        </div>
                      )}
                    </>
                  )}

                  {item.materialType === "packaging" && (
                    <>
                      {item.packageType && (
                        <div className="flex justify-between pt-3 border-t">
                          <span className="text-sm font-medium text-muted-foreground">
                            Package Type
                          </span>
                          <span className="text-sm font-semibold capitalize">
                            {item.packageType}
                          </span>
                        </div>
                      )}
                      {item.materialType2 && (
                        <div className="flex justify-between">
                          <span className="text-sm font-medium text-muted-foreground">
                            Material
                          </span>
                          <span className="text-sm font-semibold">
                            {item.materialType2}
                          </span>
                        </div>
                      )}
                      {item.size && (
                        <div className="flex justify-between">
                          <span className="text-sm font-medium text-muted-foreground">
                            Size
                          </span>
                          <span className="text-sm font-semibold">
                            {item.size}
                          </span>
                        </div>
                      )}
                    </>
                  )}

                  {item.materialType === "basefruit" && item.harvestDate && (
                    <div className="flex justify-between pt-3 border-t">
                      <span className="text-sm font-medium text-muted-foreground">
                        Harvest Date
                      </span>
                      <span className="text-sm font-semibold">
                        {formatDate(item.harvestDate)}
                      </span>
                    </div>
                  )}

                  {/* Notes - for all types */}
                  {item.notes && (
                    <div className="flex flex-col pt-3 border-t">
                      <span className="text-sm font-medium text-muted-foreground mb-1">
                        Notes
                      </span>
                      <span className="text-sm text-gray-700">
                        {item.notes}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
