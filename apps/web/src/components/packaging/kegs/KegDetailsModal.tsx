"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
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
import { Card, CardContent } from "@/components/ui/card";
import { Package, Calendar, MapPin, Loader2, Wine, Edit } from "lucide-react";
import { formatDate } from "@/utils/date-format";
import { trpc } from "@/utils/trpc";
import { EditKegModal } from "./EditKegModal";

interface KegDetailsModalProps {
  open: boolean;
  onClose: () => void;
  kegId: string;
}

const KEG_STATUS_CONFIG = {
  filled: { label: "Filled", color: "bg-blue-100 text-blue-800" },
  distributed: { label: "Distributed", color: "bg-orange-100 text-orange-800" },
  returned: { label: "Returned", color: "bg-green-100 text-green-800" },
  voided: { label: "Voided", color: "bg-red-100 text-red-800" },
};

export function KegDetailsModal({
  open,
  onClose,
  kegId,
}: KegDetailsModalProps) {
  const router = useRouter();
  const [showEditModal, setShowEditModal] = useState(false);
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.packaging.kegs.getKegDetails.useQuery(
    { kegId },
    { enabled: open && !!kegId },
  );

  const keg = data?.keg;
  const fills = data?.fills || [];

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                {keg?.kegNumber || "Keg Details"}
              </DialogTitle>
              <DialogDescription>
                View keg information and fill history
              </DialogDescription>
            </div>
            {keg && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEditModal(true)}
                className="ml-4"
              >
                <Edit className="w-4 h-4 mr-1" />
                Edit Keg
              </Button>
            )}
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : !keg ? (
          <div className="text-center py-12 text-gray-500">
            Keg not found
          </div>
        ) : (
          <div className="space-y-6">
            {/* Keg Information Card */}
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Keg Number</p>
                    <p className="font-semibold">{keg.kegNumber}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Type</p>
                    <p className="font-semibold">
                      {keg.kegType.replace("_", " ")}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Capacity</p>
                    <p className="font-semibold">
                      {(keg.capacityML / 1000).toFixed(1)}L
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Status</p>
                    <Badge
                      className={
                        keg.status === "available"
                          ? "bg-green-100 text-green-800"
                          : keg.status === "filled"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-orange-100 text-orange-800"
                      }
                    >
                      {keg.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Condition</p>
                    <p className="font-semibold capitalize">{keg.condition}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Location</p>
                    <p className="font-semibold">{keg.currentLocation}</p>
                  </div>
                  {keg.purchaseDate && (
                    <div>
                      <p className="text-sm text-gray-600">Purchase Date</p>
                      <p className="font-semibold">
                        {formatDate(keg.purchaseDate)}
                      </p>
                    </div>
                  )}
                  {keg.purchaseCost && (
                    <div>
                      <p className="text-sm text-gray-600">Purchase Cost</p>
                      <p className="font-semibold">
                        ${parseFloat(keg.purchaseCost).toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>
                {keg.notes && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm text-gray-600">Notes</p>
                    <p className="text-sm mt-1">{keg.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Fill History */}
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Wine className="w-5 h-5" />
                Fill History ({fills.length})
              </h3>

              {fills.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-gray-500">
                    No fill history yet
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Filled Date</TableHead>
                            <TableHead>Batch</TableHead>
                            <TableHead>Vessel</TableHead>
                            <TableHead className="text-right">
                              Volume
                            </TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Distributed</TableHead>
                            <TableHead>Location</TableHead>
                            <TableHead>Returned</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {fills.map((fill: any) => {
                            const statusConfig =
                              KEG_STATUS_CONFIG[
                                fill.status as keyof typeof KEG_STATUS_CONFIG
                              ];
                            return (
                              <TableRow
                                key={fill.id}
                                onClick={() => router.push(`/keg-fills/${fill.id}`)}
                                className="cursor-pointer hover:bg-gray-50 transition-colors"
                              >
                                <TableCell>
                                  <div className="flex items-center gap-1 text-sm">
                                    <Calendar className="w-3 h-3 text-gray-400" />
                                    {formatDate(fill.filledAt)}
                                  </div>
                                </TableCell>
                                <TableCell className="font-medium">
                                  {fill.batchCustomName || fill.batchName}
                                </TableCell>
                                <TableCell>{fill.vesselName}</TableCell>
                                <TableCell className="text-right font-mono">
                                  {parseFloat(fill.volumeTaken).toFixed(1)}
                                  {fill.volumeTakenUnit}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    className={statusConfig?.color}
                                    variant="secondary"
                                  >
                                    {statusConfig?.label || fill.status}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {fill.distributedAt ? (
                                    <div className="text-sm">
                                      {formatDate(fill.distributedAt)}
                                    </div>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {fill.distributionLocation ? (
                                    <div className="flex items-center gap-1 text-sm">
                                      <MapPin className="w-3 h-3 text-gray-400" />
                                      {fill.distributionLocation}
                                    </div>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {fill.returnedAt ? (
                                    <div className="text-sm">
                                      {formatDate(fill.returnedAt)}
                                    </div>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {showEditModal && (
          <EditKegModal
            open={showEditModal}
            onClose={() => setShowEditModal(false)}
            kegId={kegId}
            onSuccess={() => {
              setShowEditModal(false);
              utils.packaging.kegs.getKegDetails.invalidate({ kegId });
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
