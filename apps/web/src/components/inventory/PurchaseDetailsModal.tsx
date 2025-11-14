"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ShoppingCart,
  Calendar,
  DollarSign,
  Package,
  Loader2,
  AlertTriangle,
  FileText,
  User,
  ExternalLink,
} from "lucide-react";
import { trpc } from "@/utils/trpc";
import { formatDate } from "@/utils/date-format";

interface PurchaseDetailsModalProps {
  open: boolean;
  onClose: () => void;
  purchaseId: string;
  materialType: "basefruit" | "additives" | "juice" | "packaging";
}

export function PurchaseDetailsModal({
  open,
  onClose,
  purchaseId,
  materialType,
}: PurchaseDetailsModalProps) {
  // Fetch purchase details based on material type
  const { data, isLoading, error } = trpc.purchase.getDetails.useQuery(
    {
      purchaseId,
      materialType,
    },
    {
      enabled: open && !!purchaseId,
    },
  );

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const getMaterialTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      basefruit: "Base Fruit",
      additives: "Additives",
      juice: "Juice",
      packaging: "Packaging",
    };
    return labels[type] || type;
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                Purchase Details
              </DialogTitle>
              <DialogDescription>
                View complete transaction information
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 p-4 text-red-600 bg-red-50 rounded-lg">
            <AlertTriangle className="w-4 h-4" />
            <span>Error loading purchase details: {error.message}</span>
          </div>
        ) : !data ? (
          <div className="text-center py-12 text-gray-500">
            Purchase not found
          </div>
        ) : (
          <div className="space-y-6">
            {/* Purchase Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <User className="w-5 h-5 text-muted-foreground mt-0.5" />
                    <div>
                      <div className="text-sm text-muted-foreground">
                        Vendor
                      </div>
                      <div className="font-semibold">{data.vendorName}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <Calendar className="w-5 h-5 text-muted-foreground mt-0.5" />
                    <div>
                      <div className="text-sm text-muted-foreground">
                        Purchase Date
                      </div>
                      <div className="font-semibold">
                        {formatDate(new Date(data.purchaseDate))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <Package className="w-5 h-5 text-muted-foreground mt-0.5" />
                    <div>
                      <div className="text-sm text-muted-foreground">
                        Material Type
                      </div>
                      <div className="font-semibold">
                        {getMaterialTypeLabel(materialType)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <DollarSign className="w-5 h-5 text-muted-foreground mt-0.5" />
                    <div>
                      <div className="text-sm text-muted-foreground">
                        Total Cost
                      </div>
                      <div className="text-xl font-bold text-primary">
                        {formatCurrency(
                          typeof data.totalCost === "string"
                            ? parseFloat(data.totalCost)
                            : data.totalCost
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Notes Section */}
            {data.notes && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="w-4 h-4" />
                    Notes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {data.notes}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Purchase Items Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Package className="w-4 h-4" />
                  Purchase Items ({data.items.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead className="text-right">
                          Price/Unit
                        </TableHead>
                        <TableHead className="text-right">
                          Total Cost
                        </TableHead>
                        {materialType === "basefruit" && (
                          <TableHead>Harvest Date</TableHead>
                        )}
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.items.map((item: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <div className="font-medium">
                              {item.varietyName || item.name}
                            </div>
                            {item.brandManufacturer && (
                              <div className="text-xs text-muted-foreground">
                                {item.brandManufacturer}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {item.quantity} {item.unit}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(item.pricePerUnit)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(item.totalCost)}
                          </TableCell>
                          {materialType === "basefruit" && (
                            <TableCell>
                              {item.harvestDate
                                ? formatDate(new Date(item.harvestDate))
                                : "—"}
                            </TableCell>
                          )}
                          <TableCell className="max-w-[200px]">
                            {item.notes ? (
                              <span className="text-sm text-muted-foreground line-clamp-2">
                                {item.notes}
                              </span>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Metadata */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Metadata</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Created At</div>
                    <div className="font-medium">
                      {formatDate(new Date(data.createdAt))}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Last Updated</div>
                    <div className="font-medium">
                      {formatDate(new Date(data.updatedAt))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
