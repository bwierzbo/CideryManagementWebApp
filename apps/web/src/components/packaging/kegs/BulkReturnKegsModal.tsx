"use client";

import React, { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/utils/trpc";
import { toast } from "@/hooks/use-toast";
import { RotateCcw, AlertTriangle, Beer, MapPin, Calendar } from "lucide-react";
import { formatDate } from "@/utils/date-format";

const bulkReturnSchema = z.object({
  returnedAt: z.string().min(1, "Date is required"),
});

type BulkReturnForm = z.infer<typeof bulkReturnSchema>;

interface SelectedKeg {
  id: string;
  kegNumber: string | null;
  status: string | null;
  distributedAt?: Date | string | null;
  distributionLocation?: string | null;
}

interface BulkReturnKegsModalProps {
  open: boolean;
  onClose: () => void;
  selectedKegs: SelectedKeg[];
  onSuccess?: () => void;
}

export function BulkReturnKegsModal({
  open,
  onClose,
  selectedKegs,
  onSuccess,
}: BulkReturnKegsModalProps) {
  const utils = trpc.useUtils();

  // Separate valid (distributed) from invalid kegs
  const { validKegs, invalidKegs } = useMemo(() => {
    const valid = selectedKegs.filter((k) => k.status === "distributed");
    const invalid = selectedKegs.filter((k) => k.status !== "distributed");
    return { validKegs: valid, invalidKegs: invalid };
  }, [selectedKegs]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<BulkReturnForm>({
    resolver: zodResolver(bulkReturnSchema),
    defaultValues: {
      returnedAt: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16),
    },
  });

  const bulkReturnMutation = trpc.packaging.kegs.bulkReturnKegFills.useMutation({
    onSuccess: (result) => {
      const skippedMsg = result.skipped.length > 0
        ? ` (${result.skipped.length} skipped)`
        : "";
      toast({
        title: "Kegs Returned",
        description: `${result.returned} keg${result.returned !== 1 ? "s" : ""} returned successfully${skippedMsg}`,
      });
      // Invalidate queries to refresh the table
      utils.packaging.list.invalidate();
      utils.packaging.kegs.listKegs.invalidate();
      reset();
      onSuccess?.();
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: BulkReturnForm) => {
    const returnedAt = new Date(data.returnedAt);
    bulkReturnMutation.mutate({
      kegFillIds: validKegs.map((k) => k.id),
      returnedAt,
    });
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            Return {validKegs.length} Keg{validKegs.length !== 1 ? "s" : ""}
          </DialogTitle>
          <DialogDescription>
            Mark selected kegs as returned. They will be set to cleaning status.
          </DialogDescription>
        </DialogHeader>

        {/* Selected Kegs List */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <Beer className="h-4 w-4" />
            Selected Kegs ({validKegs.length})
          </Label>
          <div className="max-h-48 overflow-y-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted sticky top-0">
                <tr className="border-b">
                  <th className="text-left py-2 px-3 font-medium">Keg</th>
                  <th className="text-left py-2 px-3 font-medium">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      Location
                    </span>
                  </th>
                  <th className="text-left py-2 px-3 font-medium">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Distributed
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {validKegs.map((keg) => (
                  <tr key={keg.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="py-2 px-3 font-medium">
                      {keg.kegNumber || keg.id.slice(0, 8)}
                    </td>
                    <td className="py-2 px-3 text-muted-foreground">
                      {keg.distributionLocation || "—"}
                    </td>
                    <td className="py-2 px-3 text-muted-foreground">
                      {keg.distributedAt ? formatDate(keg.distributedAt.toString()) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Warning for invalid kegs */}
        {invalidKegs.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-yellow-800">
                  {invalidKegs.length} keg{invalidKegs.length !== 1 ? "s" : ""} cannot be returned
                </p>
                <p className="text-yellow-700 mt-1">
                  Kegs must be in "distributed" status before they can be returned. These kegs are not yet distributed:
                </p>
                <div className="mt-2 space-y-1">
                  {invalidKegs.map((keg) => (
                    <div key={keg.id} className="flex items-center gap-2 text-xs text-yellow-700">
                      <Badge variant="outline" className="text-xs text-yellow-700 border-yellow-300">
                        {keg.kegNumber || keg.id.slice(0, 8)}
                      </Badge>
                      <span>→</span>
                      <span className="italic">
                        {keg.status === "filled"
                          ? "Still filled — distribute first before returning"
                          : keg.status === "available"
                          ? "Empty keg — fill and distribute first"
                          : keg.status === "cleaning"
                          ? "Being cleaned — already returned"
                          : `Status: ${keg.status}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {validKegs.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
            <p className="font-medium">No kegs can be returned</p>
            <p className="text-sm mt-1">
              Only kegs that have been distributed can be returned.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Tip: Distribute filled kegs first, then return them when they come back empty.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Return Date & Time */}
            <div>
              <Label htmlFor="returnedAt">
                Return Date & Time <span className="text-red-500">*</span>
              </Label>
              <Input
                id="returnedAt"
                type="datetime-local"
                {...register("returnedAt")}
                className="mt-1"
              />
              {errors.returnedAt && (
                <p className="text-sm text-red-600 mt-1">
                  {errors.returnedAt.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                All {validKegs.length} kegs will be marked as returned at this time
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                Returned kegs will be set to "cleaning" status and their location will be updated to "cellar".
              </p>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={bulkReturnMutation.isPending}>
                {bulkReturnMutation.isPending
                  ? "Returning..."
                  : `Return ${validKegs.length} Keg${validKegs.length !== 1 ? "s" : ""}`}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
