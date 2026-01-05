"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Plus, X, Users, DollarSign, Clock, AlertCircle } from "lucide-react";
import { trpc } from "@/utils/trpc";
import { cn } from "@/lib/utils";

export interface WorkerAssignment {
  workerId: string;
  workerName: string;
  hoursWorked: number;
  hourlyRate: number;
  laborCost: number;
}

interface WorkerLaborInputProps {
  value: WorkerAssignment[];
  onChange: (assignments: WorkerAssignment[]) => void;
  activityLabel?: string;
  className?: string;
  disabled?: boolean;
}

export function WorkerLaborInput({
  value,
  onChange,
  activityLabel = "this activity",
  className,
  disabled = false,
}: WorkerLaborInputProps) {
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>("");
  const [hoursInput, setHoursInput] = useState<string>("");

  const { data: workersData, isLoading } = trpc.workers.list.useQuery();
  const workers = workersData?.workers || [];

  // Filter out workers that are already assigned
  const availableWorkers = workers.filter(
    (w) => !value.some((v) => v.workerId === w.id)
  );

  const handleAddWorker = () => {
    if (!selectedWorkerId || !hoursInput) return;

    const worker = workers.find((w) => w.id === selectedWorkerId);
    if (!worker) return;

    const hours = parseFloat(hoursInput);
    if (isNaN(hours) || hours <= 0) return;

    const hourlyRate = parseFloat(worker.hourlyRate ?? "20.00");
    const newAssignment: WorkerAssignment = {
      workerId: worker.id,
      workerName: worker.name,
      hoursWorked: hours,
      hourlyRate,
      laborCost: hours * hourlyRate,
    };

    onChange([...value, newAssignment]);
    setSelectedWorkerId("");
    setHoursInput("");
  };

  const handleRemoveWorker = (workerId: string) => {
    onChange(value.filter((v) => v.workerId !== workerId));
  };

  const handleUpdateHours = (workerId: string, hours: number) => {
    if (isNaN(hours) || hours < 0) return;
    onChange(
      value.map((v) =>
        v.workerId === workerId
          ? { ...v, hoursWorked: hours, laborCost: hours * v.hourlyRate }
          : v
      )
    );
  };

  const totalLaborCost = value.reduce((sum, v) => sum + v.laborCost, 0);
  const totalHours = value.reduce((sum, v) => sum + v.hoursWorked, 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  return (
    <div className={cn("space-y-3", className)}>
      <Label className="flex items-center gap-2 text-sm font-medium">
        <Users className="h-4 w-4" />
        Labor Tracking (optional)
      </Label>

      {/* No workers message */}
      {!isLoading && workers.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>
            No workers configured. Add workers in{" "}
            <a href="/admin" className="underline font-medium">
              Admin &gt; Reference Data
            </a>{" "}
            to track labor costs.
          </span>
        </div>
      )}

      {/* Add Worker Section */}
      {workers.length > 0 && (
        <Card className="p-3 space-y-3 bg-gray-50">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
            <div className="sm:col-span-5">
              <Select
                value={selectedWorkerId}
                onValueChange={setSelectedWorkerId}
                disabled={disabled || availableWorkers.length === 0}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Select worker..." />
                </SelectTrigger>
                <SelectContent>
                  {isLoading ? (
                    <SelectItem value="loading" disabled>
                      Loading...
                    </SelectItem>
                  ) : availableWorkers.length === 0 ? (
                    <SelectItem value="none" disabled>
                      All workers assigned
                    </SelectItem>
                  ) : (
                    availableWorkers.map((worker) => (
                      <SelectItem key={worker.id} value={worker.id}>
                        {worker.name} ({formatCurrency(parseFloat(worker.hourlyRate ?? "20"))}/hr)
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-4">
              <div className="relative">
                <Input
                  type="number"
                  step="0.25"
                  min="0"
                  placeholder="Hours"
                  value={hoursInput}
                  onChange={(e) => setHoursInput(e.target.value)}
                  disabled={disabled || !selectedWorkerId}
                  className="bg-white pr-10"
                />
                <Clock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <div className="sm:col-span-3">
              <Button
                type="button"
                onClick={handleAddWorker}
                disabled={disabled || !selectedWorkerId || !hoursInput}
                className="w-full"
                size="default"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Selected Workers List */}
      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((assignment) => (
            <Card key={assignment.workerId} className="p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{assignment.workerName}</p>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {assignment.hoursWorked}h
                    </span>
                    <span>@</span>
                    <span>{formatCurrency(assignment.hourlyRate)}/hr</span>
                    <span>=</span>
                    <span className="font-medium text-green-600">
                      {formatCurrency(assignment.laborCost)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Input
                    type="number"
                    step="0.25"
                    min="0"
                    className="w-20 h-8 text-center"
                    value={assignment.hoursWorked}
                    onChange={(e) =>
                      handleUpdateHours(
                        assignment.workerId,
                        parseFloat(e.target.value) || 0
                      )
                    }
                    disabled={disabled}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveWorker(assignment.workerId)}
                    disabled={disabled}
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}

          {/* Summary */}
          <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
            <div className="flex flex-wrap justify-between items-center gap-2 text-sm">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4 text-blue-600" />
                  <span className="font-medium">{value.length}</span> worker{value.length !== 1 ? "s" : ""}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4 text-blue-600" />
                  <span className="font-medium">{totalHours.toFixed(2)}</span> hours
                </span>
              </div>
              <span className="flex items-center gap-1 font-semibold text-green-600">
                <DollarSign className="h-4 w-4" />
                Total: {formatCurrency(totalLaborCost)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function to convert WorkerAssignment[] to API format
export function toApiLaborAssignments(
  assignments: WorkerAssignment[]
): Array<{ workerId: string; hoursWorked: number }> {
  return assignments.map((a) => ({
    workerId: a.workerId,
    hoursWorked: a.hoursWorked,
  }));
}
