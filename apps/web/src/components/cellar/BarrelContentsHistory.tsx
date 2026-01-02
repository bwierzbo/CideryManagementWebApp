"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Edit,
  Trash2,
  Calendar,
  Wine,
  Loader2,
  History,
  Link as LinkIcon,
} from "lucide-react";
import { trpc } from "@/utils/trpc";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/utils/date-format";

const contentsHistorySchema = z.object({
  contentsType: z.string().min(1, "Contents type is required"),
  contentsDescription: z.string().optional(),
  startedAt: z.string().min(1, "Start date is required"),
  endedAt: z.string().optional(),
  source: z.enum(["pre_purchase", "manual"]),
  tastingNotes: z.string().optional(),
  flavorImpact: z.string().optional(),
});

type ContentsHistoryForm = z.infer<typeof contentsHistorySchema>;

interface BarrelContentsHistoryProps {
  vesselId: string;
  vesselName?: string;
}

export function BarrelContentsHistory({ vesselId, vesselName }: BarrelContentsHistoryProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<ContentsHistoryForm>({
    resolver: zodResolver(contentsHistorySchema),
    defaultValues: {
      source: "pre_purchase",
    },
  });

  // Fetch barrel origin types for dropdown
  const originTypesQuery = trpc.barrelOriginTypes.list.useQuery();

  // Fetch contents history for this vessel
  const historyQuery = trpc.barrelContentsHistory.listByVessel.useQuery({
    vesselId,
  });

  const createMutation = trpc.barrelContentsHistory.create.useMutation({
    onSuccess: () => {
      utils.barrelContentsHistory.listByVessel.invalidate({ vesselId });
      setIsAddDialogOpen(false);
      reset();
      toast({
        title: "Success",
        description: "Contents history entry added",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = trpc.barrelContentsHistory.update.useMutation({
    onSuccess: () => {
      utils.barrelContentsHistory.listByVessel.invalidate({ vesselId });
      setEditingEntry(null);
      reset();
      toast({
        title: "Success",
        description: "Contents history entry updated",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = trpc.barrelContentsHistory.delete.useMutation({
    onSuccess: () => {
      utils.barrelContentsHistory.listByVessel.invalidate({ vesselId });
      toast({
        title: "Success",
        description: "Contents history entry deleted",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ContentsHistoryForm) => {
    if (editingEntry) {
      updateMutation.mutate({
        id: editingEntry.id,
        contentsType: data.contentsType,
        contentsDescription: data.contentsDescription || undefined,
        startedAt: data.startedAt,
        endedAt: data.endedAt || null,
        tastingNotes: data.tastingNotes || null,
        flavorImpact: data.flavorImpact || null,
      });
    } else {
      createMutation.mutate({
        vesselId,
        contentsType: data.contentsType,
        contentsDescription: data.contentsDescription || undefined,
        startedAt: data.startedAt,
        endedAt: data.endedAt || undefined,
        source: data.source,
        tastingNotes: data.tastingNotes || undefined,
        flavorImpact: data.flavorImpact || undefined,
      });
    }
  };

  const handleEdit = (entry: any) => {
    setEditingEntry(entry);
    setValue("contentsType", entry.contentsType);
    setValue("contentsDescription", entry.contentsDescription || "");
    setValue("startedAt", entry.startedAt);
    setValue("endedAt", entry.endedAt || "");
    setValue("source", entry.source === "batch" ? "manual" : entry.source);
    setValue("tastingNotes", entry.tastingNotes || "");
    setValue("flavorImpact", entry.flavorImpact || "");
  };

  const handleDelete = (entry: any) => {
    if (entry.source === "batch") {
      toast({
        title: "Cannot Delete",
        description: "Batch entries are auto-tracked and cannot be deleted manually.",
        variant: "destructive",
      });
      return;
    }
    if (confirm(`Are you sure you want to delete this entry?`)) {
      deleteMutation.mutate({ id: entry.id });
    }
  };

  const handleOpenAdd = () => {
    reset({
      source: "pre_purchase",
      contentsType: "",
      contentsDescription: "",
      startedAt: "",
      endedAt: "",
      tastingNotes: "",
      flavorImpact: "",
    });
    setIsAddDialogOpen(true);
  };

  const formatContentsType = (type: string) => {
    // Check if it matches an origin type
    const originType = originTypesQuery.data?.types.find(t => t.slug === type);
    if (originType) return originType.name;
    // Otherwise format the string
    return type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const getSourceBadge = (source: string) => {
    switch (source) {
      case "pre_purchase":
        return <Badge variant="outline" className="text-xs">Pre-purchase</Badge>;
      case "batch":
        return <Badge className="bg-blue-100 text-blue-800 border-0 text-xs">Auto-tracked</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">Manual</Badge>;
    }
  };

  const entries = historyQuery.data?.entries || [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Contents History
          </CardTitle>
          <CardDescription>
            Track what has been stored in this barrel over time
          </CardDescription>
        </div>
        <Button onClick={handleOpenAdd} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Entry
        </Button>
      </CardHeader>
      <CardContent>
        {historyQuery.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground bg-gray-50 rounded-lg">
            <Wine className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No contents history recorded yet.</p>
            <p className="text-sm mt-1">Add pre-purchase history or batch entries will be tracked automatically.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry, index) => (
              <div
                key={entry.id}
                className="bg-white border rounded-lg p-4 relative"
              >
                {/* Timeline connector */}
                {index < entries.length - 1 && (
                  <div className="absolute left-6 top-full w-0.5 h-3 bg-gray-200" />
                )}

                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">
                        {formatContentsType(entry.contentsType)}
                      </span>
                      {getSourceBadge(entry.source)}
                    </div>

                    {entry.contentsDescription && (
                      <p className="text-sm text-muted-foreground mb-2">
                        {entry.contentsDescription}
                      </p>
                    )}

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>{formatDate(entry.startedAt)}</span>
                      {entry.endedAt ? (
                        <>
                          <span>-</span>
                          <span>{formatDate(entry.endedAt)}</span>
                        </>
                      ) : (
                        <Badge className="bg-green-100 text-green-800 border-0 text-xs ml-2">
                          Current
                        </Badge>
                      )}
                    </div>

                    {entry.batchId && entry.batchName && (
                      <div className="flex items-center gap-1 text-xs text-blue-600 mt-1">
                        <LinkIcon className="h-3 w-3" />
                        <span>Linked to: {entry.batchName}</span>
                      </div>
                    )}

                    {entry.tastingNotes && (
                      <p className="text-sm mt-2 text-gray-600 italic">
                        "{entry.tastingNotes}"
                      </p>
                    )}

                    {entry.flavorImpact && (
                      <p className="text-xs mt-1 text-amber-700">
                        Flavor impact: {entry.flavorImpact}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-1 ml-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(entry)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    {entry.source !== "batch" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(entry)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add/Edit Dialog */}
        <Dialog
          open={isAddDialogOpen || !!editingEntry}
          onOpenChange={(open) => {
            if (!open) {
              setIsAddDialogOpen(false);
              setEditingEntry(null);
              reset();
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingEntry ? "Edit Contents Entry" : "Add Contents Entry"}
              </DialogTitle>
              <DialogDescription>
                {editingEntry
                  ? "Update the details of this barrel contents entry"
                  : "Record what was stored in this barrel"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {!editingEntry && (
                <div>
                  <Label htmlFor="source">Entry Type</Label>
                  <Select
                    value={watch("source")}
                    onValueChange={(value) => setValue("source", value as any)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pre_purchase">Pre-purchase (before you owned it)</SelectItem>
                      <SelectItem value="manual">Manual entry</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label htmlFor="contentsType">What was in the barrel?</Label>
                <Select
                  value={watch("contentsType")}
                  onValueChange={(value) => setValue("contentsType", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select contents type" />
                  </SelectTrigger>
                  <SelectContent>
                    {originTypesQuery.data?.types.map((type) => (
                      <SelectItem key={type.id} value={type.slug}>
                        {type.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="cider">Cider</SelectItem>
                    <SelectItem value="perry">Perry</SelectItem>
                    <SelectItem value="brandy">Brandy</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {errors.contentsType && (
                  <p className="text-sm text-red-600 mt-1">{errors.contentsType.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="contentsDescription">Description (optional)</Label>
                <Input
                  id="contentsDescription"
                  placeholder="e.g., Caudil Distillery 4-year Rye"
                  {...register("contentsDescription")}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startedAt">Start Date</Label>
                  <Input
                    id="startedAt"
                    type="date"
                    {...register("startedAt")}
                  />
                  {errors.startedAt && (
                    <p className="text-sm text-red-600 mt-1">{errors.startedAt.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="endedAt">End Date (optional)</Label>
                  <Input
                    id="endedAt"
                    type="date"
                    {...register("endedAt")}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="tastingNotes">Tasting Notes (optional)</Label>
                <Textarea
                  id="tastingNotes"
                  placeholder="What flavor characteristics did this contribute?"
                  {...register("tastingNotes")}
                  rows={2}
                />
              </div>

              <div>
                <Label htmlFor="flavorImpact">Flavor Impact (optional)</Label>
                <Input
                  id="flavorImpact"
                  placeholder="e.g., Strong rye spice, now mellowing"
                  {...register("flavorImpact")}
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsAddDialogOpen(false);
                    setEditingEntry(null);
                    reset();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? "Saving..."
                    : editingEntry
                      ? "Update"
                      : "Add Entry"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
