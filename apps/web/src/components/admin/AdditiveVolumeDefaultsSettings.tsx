"use client";

/**
 * Settings UI for managing per-additive default volume contributions.
 *
 * Each row defines: when the operator records an additive of `additiveType`
 * whose name matches `namePattern` (case-insensitive substring; null = match
 * all of type), suggest a volume contribution of `mass / densityKgPerL`.
 *
 * The operator can always override the suggestion in the additive form.
 * Used for honey, brandy/spirits, fruit purée, juice concentrate, sugar
 * syrup — anything that adds material liquid to the batch.
 */

import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Beaker, Plus, Pencil, Trash2 } from "lucide-react";
import { trpc } from "@/utils/trpc";
import { toast } from "@/hooks/use-toast";

const ADDITIVE_TYPES = [
  "Fermentation Organisms",
  "Sugar & Sweeteners",
  "Fruit/Fruit Product",
  "Flavorings & Adjuncts",
  "Enzymes",
  "Nutrients",
  "Acids",
  "Tannins & Mouthfeel",
  "Preservatives",
];

interface FormState {
  id?: string;
  additiveType: string;
  namePattern: string;
  densityKgPerL: string;
  displayLabel: string;
  notes: string;
  sortOrder: string;
}

const EMPTY_FORM: FormState = {
  additiveType: "Sugar & Sweeteners",
  namePattern: "",
  densityKgPerL: "",
  displayLabel: "",
  notes: "",
  sortOrder: "100",
};

export function AdditiveVolumeDefaultsSettings() {
  const utils = trpc.useUtils();
  const { data: rows, isPending } = trpc.settings.listVolumeDefaults.useQuery();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const createMut = trpc.settings.createVolumeDefault.useMutation({
    onSuccess: () => {
      utils.settings.listVolumeDefaults.invalidate();
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      toast({ title: "Volume default added" });
    },
    onError: (e) => toast({ title: "Failed to add", description: e.message, variant: "destructive" }),
  });

  const updateMut = trpc.settings.updateVolumeDefault.useMutation({
    onSuccess: () => {
      utils.settings.listVolumeDefaults.invalidate();
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      toast({ title: "Volume default updated" });
    },
    onError: (e) => toast({ title: "Failed to update", description: e.message, variant: "destructive" }),
  });

  const deleteMut = trpc.settings.deleteVolumeDefault.useMutation({
    onSuccess: () => {
      utils.settings.listVolumeDefaults.invalidate();
      toast({ title: "Volume default deleted" });
    },
    onError: (e) => toast({ title: "Failed to delete", description: e.message, variant: "destructive" }),
  });

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (row: any) => {
    setForm({
      id: row.id,
      additiveType: row.additiveType,
      namePattern: row.namePattern ?? "",
      densityKgPerL: row.densityKgPerL.toString(),
      displayLabel: row.displayLabel,
      notes: row.notes ?? "",
      sortOrder: row.sortOrder?.toString() ?? "100",
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    const density = parseFloat(form.densityKgPerL);
    if (!Number.isFinite(density) || density <= 0) {
      toast({ title: "Invalid density", description: "Density must be a positive number (kg per liter)", variant: "destructive" });
      return;
    }
    if (!form.displayLabel.trim()) {
      toast({ title: "Label required", variant: "destructive" });
      return;
    }
    const payload = {
      additiveType: form.additiveType,
      namePattern: form.namePattern.trim() || null,
      densityKgPerL: density,
      displayLabel: form.displayLabel.trim(),
      notes: form.notes.trim() || null,
      sortOrder: parseInt(form.sortOrder, 10) || 0,
    };
    if (form.id) {
      updateMut.mutate({ id: form.id, ...payload });
    } else {
      createMut.mutate(payload);
    }
  };

  const handleDelete = (row: any) => {
    if (!window.confirm(`Delete volume default "${row.displayLabel}"?`)) return;
    deleteMut.mutate({ id: row.id });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Beaker className="h-5 w-5" />
              Additive volume defaults
            </CardTitle>
            <CardDescription>
              Per-ingredient densities used to suggest a volume contribution
              when recording an additive. Critical for honey (cyser),
              brandy/spirits (fortification), fruit purée, and juice concentrate.
              Operators can override the suggestion.
            </CardDescription>
          </div>
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add default
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : !rows || rows.length === 0 ? (
          <div className="text-sm text-muted-foreground italic">No defaults configured.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Additive type</TableHead>
                <TableHead>Name match</TableHead>
                <TableHead>Density (kg/L)</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row: any) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.displayLabel}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{row.additiveType}</Badge>
                  </TableCell>
                  <TableCell className="text-sm font-mono">
                    {row.namePattern ? <code>contains "{row.namePattern}"</code> : <span className="text-muted-foreground italic">any</span>}
                  </TableCell>
                  <TableCell>{row.densityKgPerL}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-md truncate" title={row.notes ?? ""}>{row.notes}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(row)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(row)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit volume default" : "New volume default"}</DialogTitle>
            <DialogDescription>
              When an operator records an additive of this type whose name
              matches the pattern, the form will suggest a volume contribution
              of <code>mass ÷ density</code>.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Display label *</Label>
              <Input
                placeholder="e.g. Honey"
                value={form.displayLabel}
                onChange={(e) => setForm({ ...form, displayLabel: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Additive type *</Label>
                <Select
                  value={form.additiveType}
                  onValueChange={(v) => setForm({ ...form, additiveType: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ADDITIVE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Density (kg / L) *</Label>
                <Input
                  type="number"
                  step="0.001"
                  min="0.001"
                  placeholder="1.42"
                  value={form.densityKgPerL}
                  onChange={(e) => setForm({ ...form, densityKgPerL: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Name pattern (optional)</Label>
              <Input
                placeholder="honey"
                value={form.namePattern}
                onChange={(e) => setForm({ ...form, namePattern: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Case-insensitive substring matched against the additive name.
                Leave blank to match every additive of this type.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="Density depends on water content / ABV / etc."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="min-h-[60px]"
              />
            </div>
            <div className="space-y-2">
              <Label>Sort order</Label>
              <Input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Lower number = matched first when multiple rules apply.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending}>
              {form.id ? "Save changes" : "Add default"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
