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
} from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Wine, Lock } from "lucide-react";
import { trpc } from "@/utils/trpc";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";

const originTypeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required").regex(/^[a-z0-9_]+$/, "Slug must be lowercase letters, numbers, and underscores only"),
  description: z.string().optional(),
  sortOrder: z.number().int(),
});

type OriginTypeForm = z.infer<typeof originTypeSchema>;

export function BarrelOriginTypesManagement() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<any>(null);
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<OriginTypeForm>({
    resolver: zodResolver(originTypeSchema),
    defaultValues: {
      sortOrder: 50,
    },
  });

  // Fetch all barrel origin types
  const typesQuery = trpc.barrelOriginTypes.list.useQuery({
    includeInactive: true,
  });

  const createMutation = trpc.barrelOriginTypes.create.useMutation({
    onSuccess: () => {
      utils.barrelOriginTypes.list.invalidate();
      setIsAddDialogOpen(false);
      reset();
      toast({
        title: "Success",
        description: "Barrel origin type created successfully",
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

  const updateMutation = trpc.barrelOriginTypes.update.useMutation({
    onSuccess: () => {
      utils.barrelOriginTypes.list.invalidate();
      setEditingType(null);
      reset();
      toast({
        title: "Success",
        description: "Barrel origin type updated successfully",
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

  const deleteMutation = trpc.barrelOriginTypes.delete.useMutation({
    onSuccess: () => {
      utils.barrelOriginTypes.list.invalidate();
      toast({
        title: "Success",
        description: "Barrel origin type deleted successfully",
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

  const onSubmit = (data: OriginTypeForm) => {
    if (editingType) {
      updateMutation.mutate({
        id: editingType.id,
        name: data.name,
        description: data.description,
        sortOrder: data.sortOrder,
      });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (type: any) => {
    setEditingType(type);
    setValue("name", type.name);
    setValue("slug", type.slug);
    setValue("description", type.description || "");
    setValue("sortOrder", type.sortOrder);
  };

  const handleToggleActive = (type: any) => {
    updateMutation.mutate({
      id: type.id,
      isActive: !type.isActive,
    });
  };

  const handleDelete = (type: any) => {
    if (confirm(`Are you sure you want to delete "${type.name}"?`)) {
      deleteMutation.mutate({ id: type.id });
    }
  };

  // Generate slug from name
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Wine className="h-5 w-5" />
            Barrel Origin Types
          </CardTitle>
          <CardDescription>
            Manage the list of barrel previous contents options
          </CardDescription>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Type
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Sort Order</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {typesQuery.data?.types.map((type) => (
              <TableRow key={type.id} className={!type.isActive ? "opacity-50" : ""}>
                <TableCell className="font-medium">
                  {type.name}
                  {type.isSystem && (
                    <span title="System type (cannot be deleted)">
                      <Lock className="h-3 w-3 inline ml-2 text-muted-foreground" />
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground font-mono text-sm">
                  {type.slug}
                </TableCell>
                <TableCell>{type.sortOrder}</TableCell>
                <TableCell>
                  <Switch
                    checked={type.isActive}
                    onCheckedChange={() => handleToggleActive(type)}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(type)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  {!type.isSystem && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(type)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Add/Edit Dialog */}
        <Dialog
          open={isAddDialogOpen || !!editingType}
          onOpenChange={(open) => {
            if (!open) {
              setIsAddDialogOpen(false);
              setEditingType(null);
              reset();
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingType ? "Edit Barrel Origin Type" : "Add Barrel Origin Type"}
              </DialogTitle>
              <DialogDescription>
                {editingType
                  ? "Update the barrel origin type details"
                  : "Create a new barrel origin type for the dropdown"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Cognac"
                  {...register("name", {
                    onChange: (e) => {
                      if (!editingType) {
                        setValue("slug", generateSlug(e.target.value));
                      }
                    },
                  })}
                />
                {errors.name && (
                  <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="slug">Slug (internal identifier)</Label>
                <Input
                  id="slug"
                  placeholder="e.g., cognac"
                  disabled={!!editingType}
                  {...register("slug")}
                />
                {errors.slug && (
                  <p className="text-sm text-red-600 mt-1">{errors.slug.message}</p>
                )}
                {editingType && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Slug cannot be changed after creation
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="description">Description (optional)</Label>
                <Input
                  id="description"
                  placeholder="Optional description"
                  {...register("description")}
                />
              </div>
              <div>
                <Label htmlFor="sortOrder">Sort Order</Label>
                <Input
                  id="sortOrder"
                  type="number"
                  placeholder="50"
                  {...register("sortOrder", { valueAsNumber: true })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Lower numbers appear first in the dropdown
                </p>
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsAddDialogOpen(false);
                    setEditingType(null);
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
                    : editingType
                      ? "Update"
                      : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
