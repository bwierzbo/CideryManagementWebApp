"use client";

import React, { useState, useEffect } from "react";
import { trpc } from "@/utils/trpc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useDateFormat } from "@/hooks/useDateFormat";

interface Additive {
  id: string;
  additiveType: string;
  additiveName: string;
  amount: string;
  unit: string;
  addedAt: Date | string;
  notes?: string | null;
  addedBy?: string | null;
}

interface EditAdditiveDialogProps {
  additive: Additive | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const units = [
  { value: "g", label: "Grams (g)" },
  { value: "kg", label: "Kilograms (kg)" },
  { value: "lbs", label: "Pounds (lbs)" },
  { value: "ml", label: "Milliliters (ml)" },
  { value: "L", label: "Liters (L)" },
  { value: "ppm", label: "Parts per million (ppm)" },
  { value: "mg/L", label: "Milligrams per liter (mg/L)" },
  { value: "g/L", label: "Grams per liter (g/L)" },
  { value: "units", label: "Units" },
];

export function EditAdditiveDialog({
  additive,
  open,
  onClose,
  onSuccess,
}: EditAdditiveDialogProps) {
  const { toast } = useToast();
  const { formatDateTimeForInput, parseDateTimeFromInput } = useDateFormat();
  const [additiveType, setAdditiveType] = useState("");
  const [additiveName, setAdditiveName] = useState("");
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState("");
  const [addedDate, setAddedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [addedBy, setAddedBy] = useState("");

  useEffect(() => {
    if (additive && open) {
      setAdditiveType(additive.additiveType);
      setAdditiveName(additive.additiveName);
      setAmount(additive.amount);
      setUnit(additive.unit);
      setAddedDate(formatDateTimeForInput(new Date(additive.addedAt)));
      setNotes(additive.notes || "");
      setAddedBy(additive.addedBy || "");
    }
  }, [additive, open]);

  const updateAdditive = trpc.batch.updateAdditive.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Additive updated successfully",
      });
      onSuccess();
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update additive",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!additive) {
      return;
    }

    if (!additiveType || !additiveName || !amount || !unit) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const updateData: any = {
      additiveId: additive.id,
      additiveType,
      additiveName,
      amount: parseFloat(amount),
      unit,
      addedAt: parseDateTimeFromInput(addedDate).toISOString(),
    };

    if (notes !== undefined) updateData.notes = notes;
    if (addedBy !== undefined) updateData.addedBy = addedBy;

    updateAdditive.mutate(updateData);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Additive</DialogTitle>
          <DialogDescription>
            Update additive details for this batch
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="additiveType">Additive Type *</Label>
            <Input
              id="additiveType"
              value={additiveType}
              onChange={(e) => setAdditiveType(e.target.value)}
              placeholder="e.g., Yeast, Nutrient, Enzyme"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="additiveName">Additive Name *</Label>
            <Input
              id="additiveName"
              value={additiveName}
              onChange={(e) => setAdditiveName(e.target.value)}
              placeholder="e.g., Lalvin EC-1118"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g., 5"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit">Unit *</Label>
              <select
                id="unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full border rounded px-3 py-2"
                required
              >
                <option value="">Select unit</option>
                {units.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="addedDate">Date & Time Added</Label>
            <Input
              id="addedDate"
              type="datetime-local"
              value={addedDate}
              onChange={(e) => setAddedDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="addedBy">Added By</Label>
            <Input
              id="addedBy"
              value={addedBy}
              onChange={(e) => setAddedBy(e.target.value)}
              placeholder="Name of person who added this"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes about this additive"
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={updateAdditive.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateAdditive.isPending}>
              {updateAdditive.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
