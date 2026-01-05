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
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Edit, Users, DollarSign, RotateCcw } from "lucide-react";
import { trpc } from "@/utils/trpc";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";

const workerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  hourlyRate: z.number().positive("Rate must be positive"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  notes: z.string().optional(),
});

type WorkerForm = z.infer<typeof workerSchema>;

export function WorkersManagement() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<any>(null);
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<WorkerForm>({
    resolver: zodResolver(workerSchema),
    defaultValues: {
      hourlyRate: 20,
    },
  });

  // Fetch all workers
  const workersQuery = trpc.workers.list.useQuery({ includeInactive: true });

  const createMutation = trpc.workers.create.useMutation({
    onSuccess: () => {
      utils.workers.list.invalidate();
      setIsAddDialogOpen(false);
      reset();
      toast({
        title: "Success",
        description: "Worker created successfully",
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

  const updateMutation = trpc.workers.update.useMutation({
    onSuccess: () => {
      utils.workers.list.invalidate();
      setEditingWorker(null);
      reset();
      toast({
        title: "Success",
        description: "Worker updated successfully",
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

  const deleteMutation = trpc.workers.delete.useMutation({
    onSuccess: () => {
      utils.workers.list.invalidate();
      toast({
        title: "Success",
        description: "Worker deactivated successfully",
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

  const restoreMutation = trpc.workers.restore.useMutation({
    onSuccess: () => {
      utils.workers.list.invalidate();
      toast({
        title: "Success",
        description: "Worker restored successfully",
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

  const onSubmit = (data: WorkerForm) => {
    if (editingWorker) {
      updateMutation.mutate({
        id: editingWorker.id,
        name: data.name,
        hourlyRate: data.hourlyRate,
        email: data.email || null,
        phone: data.phone || null,
        notes: data.notes || null,
      });
    } else {
      createMutation.mutate({
        name: data.name,
        hourlyRate: data.hourlyRate,
        email: data.email || undefined,
        phone: data.phone,
        notes: data.notes,
      });
    }
  };

  const handleEdit = (worker: any) => {
    setEditingWorker(worker);
    setValue("name", worker.name);
    setValue("hourlyRate", parseFloat(worker.hourlyRate));
    setValue("email", worker.email || "");
    setValue("phone", worker.phone || "");
    setValue("notes", worker.notes || "");
  };

  const handleToggleActive = (worker: any) => {
    if (worker.isActive) {
      // Deactivate
      deleteMutation.mutate({ id: worker.id });
    } else {
      // Restore
      restoreMutation.mutate({ id: worker.id });
    }
  };

  const formatCurrency = (value: string | number) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(num);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Workers
          </CardTitle>
          <CardDescription>
            Manage workers and their hourly rates for labor tracking
          </CardDescription>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Worker
        </Button>
      </CardHeader>
      <CardContent>
        {workersQuery.isLoading ? (
          <div className="text-center py-4 text-muted-foreground">Loading workers...</div>
        ) : workersQuery.data?.workers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No workers yet. Add your first worker to start tracking labor costs.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Hourly Rate</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workersQuery.data?.workers.map((worker) => (
                <TableRow
                  key={worker.id}
                  className={!worker.isActive ? "opacity-50" : ""}
                >
                  <TableCell className="font-medium">{worker.name}</TableCell>
                  <TableCell>
                    <span className="flex items-center text-green-600 font-medium">
                      <DollarSign className="h-3 w-3" />
                      {parseFloat(worker.hourlyRate ?? "20").toFixed(2)}/hr
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {worker.email || "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {worker.phone || "-"}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={worker.isActive}
                      onCheckedChange={() => handleToggleActive(worker)}
                      disabled={deleteMutation.isPending || restoreMutation.isPending}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(worker)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    {!worker.isActive && worker.deletedAt && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => restoreMutation.mutate({ id: worker.id })}
                        disabled={restoreMutation.isPending}
                        title="Restore worker"
                      >
                        <RotateCcw className="h-4 w-4 text-blue-500" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Add/Edit Dialog */}
        <Dialog
          open={isAddDialogOpen || !!editingWorker}
          onOpenChange={(open) => {
            if (!open) {
              setIsAddDialogOpen(false);
              setEditingWorker(null);
              reset({ hourlyRate: 20 });
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingWorker ? "Edit Worker" : "Add Worker"}
              </DialogTitle>
              <DialogDescription>
                {editingWorker
                  ? "Update worker details and hourly rate"
                  : "Add a new worker for labor tracking. The hourly rate will be used to calculate labor costs."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  placeholder="Worker name"
                  {...register("name")}
                />
                {errors.name && (
                  <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="hourlyRate">Hourly Rate ($) *</Label>
                <Input
                  id="hourlyRate"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="20.00"
                  {...register("hourlyRate", { valueAsNumber: true })}
                />
                {errors.hourlyRate && (
                  <p className="text-sm text-red-600 mt-1">{errors.hourlyRate.message}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  This rate will be used to calculate labor costs for activities
                </p>
              </div>
              <div>
                <Label htmlFor="email">Email (optional)</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="worker@example.com"
                  {...register("email")}
                />
                {errors.email && (
                  <p className="text-sm text-red-600 mt-1">{errors.email.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="phone">Phone (optional)</Label>
                <Input
                  id="phone"
                  placeholder="(555) 123-4567"
                  {...register("phone")}
                />
              </div>
              <div>
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Additional notes about this worker"
                  rows={2}
                  {...register("notes")}
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsAddDialogOpen(false);
                    setEditingWorker(null);
                    reset({ hourlyRate: 20 });
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
                    : editingWorker
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
