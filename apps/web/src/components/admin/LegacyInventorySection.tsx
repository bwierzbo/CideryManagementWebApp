"use client";

import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Archive,
  Plus,
  Loader2,
  Trash2,
  Wine,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { trpc } from "@/utils/trpc";
import { useToast } from "@/hooks/use-toast";

const TAX_CLASS_OPTIONS = [
  { value: "hardCider", label: "Hard Cider (<8.5% ABV)", productType: "cider" },
  { value: "wineUnder16", label: "Wine (<16% ABV)", productType: "wine" },
  { value: "wine16To21", label: "Wine (16-21% ABV)", productType: "wine" },
  { value: "wine21To24", label: "Wine (21-24% ABV)", productType: "wine" },
  { value: "sparklingWine", label: "Sparkling Wine", productType: "wine" },
  { value: "carbonatedWine", label: "Carbonated Wine", productType: "wine" },
  { value: "appleBrandy", label: "Apple Brandy", productType: "brandy" },
  { value: "grapeSpirits", label: "Grape Spirits", productType: "brandy" },
] as const;

type TaxClass = (typeof TAX_CLASS_OPTIONS)[number]["value"];

interface FormData {
  name: string;
  volumeGallons: string;
  taxClass: TaxClass;
  asOfDate: string;
  notes: string;
}

const initialFormData: FormData = {
  name: "",
  volumeGallons: "",
  taxClass: "hardCider",
  asOfDate: "",
  notes: "",
};

export function LegacyInventorySection() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch TTB opening balances for default date
  const { data: openingBalancesData } = trpc.ttb.getOpeningBalances.useQuery();

  // Fetch legacy batches
  const {
    data: legacyBatches,
    isLoading,
    refetch,
  } = trpc.batch.getLegacyBatches.useQuery();

  const createMutation = trpc.batch.createLegacyBatch.useMutation({
    onSuccess: (data) => {
      toast({
        title: "Legacy Batch Created",
        description: `Created "${data.batch.name}" with ${data.batch.volumeGallons} gallons.`,
      });
      refetch();
      setIsOpen(false);
      setFormData(initialFormData);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = trpc.batch.deleteLegacyBatch.useMutation({
    onSuccess: () => {
      toast({
        title: "Legacy Batch Deleted",
        description: "The legacy inventory batch has been removed.",
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter a name for the legacy batch.",
        variant: "destructive",
      });
      return;
    }

    const volume = parseFloat(formData.volumeGallons);
    if (!volume || volume <= 0) {
      toast({
        title: "Volume Required",
        description: "Please enter a positive volume in gallons.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.asOfDate) {
      toast({
        title: "Date Required",
        description: "Please enter the as-of date for this inventory.",
        variant: "destructive",
      });
      return;
    }

    const selectedTaxClass = TAX_CLASS_OPTIONS.find(
      (tc) => tc.value === formData.taxClass
    );

    setIsSubmitting(true);
    try {
      await createMutation.mutateAsync({
        name: formData.name.trim(),
        volumeGallons: volume,
        productType: selectedTaxClass?.productType || "cider",
        taxClass: formData.taxClass,
        asOfDate: formData.asOfDate,
        notes: formData.notes.trim() || undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (batchId: string) => {
    await deleteMutation.mutateAsync({ batchId });
  };

  // Auto-suggest name based on tax class and year
  const handleTaxClassChange = (value: TaxClass) => {
    setFormData((prev) => {
      const taxClass = TAX_CLASS_OPTIONS.find((tc) => tc.value === value);
      const year = prev.asOfDate
        ? prev.asOfDate.split("-")[0]
        : new Date().getFullYear();
      const suggestedName = `Legacy Inventory - ${taxClass?.label || value} ${year}`;

      return {
        ...prev,
        taxClass: value,
        name: prev.name || suggestedName,
      };
    });
  };

  // When sheet opens, set default date from TTB opening balances
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open && openingBalancesData?.date && !formData.asOfDate) {
      setFormData((prev) => ({
        ...prev,
        asOfDate: openingBalancesData.date || "",
      }));
    }
    if (!open) {
      setFormData(initialFormData);
    }
  };

  const totalLegacyGallons =
    legacyBatches?.reduce((sum, batch) => sum + batch.volumeGallons, 0) || 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100 text-purple-700">
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Legacy Inventory</CardTitle>
              <CardDescription>
                Track pre-system inventory for TTB reconciliation
              </CardDescription>
            </div>
          </div>
          <Sheet open={isOpen} onOpenChange={handleOpenChange}>
            <SheetTrigger asChild>
              <Button variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Add Legacy Batch
              </Button>
            </SheetTrigger>
            <SheetContent className="sm:max-w-md">
              <SheetHeader>
                <SheetTitle>Add Legacy Inventory Batch</SheetTitle>
                <SheetDescription>
                  Create a batch for pre-system inventory that needs to be
                  tracked for TTB compliance.
                </SheetDescription>
              </SheetHeader>

              <form onSubmit={handleSubmit} className="space-y-4 mt-6">
                {/* Name */}
                <div className="space-y-2">
                  <Label htmlFor="name">Batch Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Legacy Inventory - Hard Cider 2024"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, name: e.target.value }))
                    }
                  />
                </div>

                {/* Tax Class */}
                <div className="space-y-2">
                  <Label htmlFor="taxClass">Tax Class</Label>
                  <Select
                    value={formData.taxClass}
                    onValueChange={handleTaxClassChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select tax class" />
                    </SelectTrigger>
                    <SelectContent>
                      {TAX_CLASS_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    The TTB tax classification for this inventory
                  </p>
                </div>

                {/* Volume */}
                <div className="space-y-2">
                  <Label htmlFor="volume">Volume (Gallons)</Label>
                  <Input
                    id="volume"
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="0.0"
                    value={formData.volumeGallons}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        volumeGallons: e.target.value,
                      }))
                    }
                  />
                </div>

                {/* As-Of Date */}
                <div className="space-y-2">
                  <Label htmlFor="asOfDate">As-Of Date</Label>
                  <Input
                    id="asOfDate"
                    type="date"
                    value={formData.asOfDate}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        asOfDate: e.target.value,
                      }))
                    }
                  />
                  <p className="text-xs text-gray-500">
                    The date this inventory was on hand (typically matches TTB
                    opening balance date)
                  </p>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Additional context about this legacy inventory..."
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, notes: e.target.value }))
                    }
                    rows={3}
                  />
                </div>

                {/* Submit */}
                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleOpenChange(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        Create Legacy Batch
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </SheetContent>
          </Sheet>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : !legacyBatches || legacyBatches.length === 0 ? (
          <div className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-gray-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-600">
                No Legacy Inventory
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                If you have pre-system inventory that doesn&apos;t trace to press
                runs or juice purchases, add it here for TTB reconciliation.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary */}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Wine className="w-4 h-4" />
              <span>
                Total legacy inventory:{" "}
                <span className="font-semibold">
                  {totalLegacyGallons.toFixed(1)} gallons
                </span>{" "}
                across {legacyBatches.length} batch
                {legacyBatches.length !== 1 ? "es" : ""}
              </span>
            </div>

            {/* Table */}
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Tax Class</TableHead>
                    <TableHead className="text-right">Volume</TableHead>
                    <TableHead>As-Of Date</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {legacyBatches.map((batch) => {
                    const taxClass = TAX_CLASS_OPTIONS.find(
                      (tc) => tc.value === batch.taxClass
                    );
                    return (
                      <TableRow key={batch.id}>
                        <TableCell className="font-medium">
                          {batch.name}
                          {batch.notes && (
                            <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[200px]">
                              {batch.notes}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {taxClass?.label || batch.taxClass}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {batch.volumeGallons.toFixed(1)} gal
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <Calendar className="w-3 h-3" />
                            {batch.asOfDate || "N/A"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-gray-400 hover:text-red-600"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Delete Legacy Batch?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete &quot;{batch.name}
                                  &quot; ({batch.volumeGallons.toFixed(1)} gallons).
                                  This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(batch.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
