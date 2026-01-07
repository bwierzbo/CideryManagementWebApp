"use client";

import React, { useState, useMemo } from "react";
import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Container } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface AssignToVesselDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batchId: string;
  batchName: string;
}

export function AssignToVesselDialog({
  open,
  onOpenChange,
  batchId,
  batchName,
}: AssignToVesselDialogProps) {
  const [selectedVesselId, setSelectedVesselId] = useState<string>("");
  const [vesselSearch, setVesselSearch] = useState("");
  const [vesselTypeFilter, setVesselTypeFilter] = useState<string>("all");

  const utils = trpc.useUtils();

  // Fetch all vessels with their batch info to determine which are empty
  const { data: vesselData, isLoading: vesselsLoading } = trpc.vessel.listWithBatches.useQuery();

  // Update mutation
  const updateMutation = trpc.batch.update.useMutation({
    onSuccess: () => {
      utils.batch.list.invalidate();
      utils.vessel.list.invalidate();
      utils.vessel.listWithBatches.invalidate();
      toast({
        title: "Success",
        description: "Batch assigned to vessel successfully",
      });
      onOpenChange(false);
      setSelectedVesselId("");
      setVesselSearch("");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Filter vessels based on search and type
  const filteredVessels = useMemo(() => {
    const allVessels = vesselData?.vessels || [];
    return allVessels.filter((vessel) => {
      // Only show empty vessels (no current batch)
      if (vessel.currentBatch) return false;

      // Apply search filter
      const vesselName = vessel.name || "";
      if (vesselSearch && !vesselName.toLowerCase().includes(vesselSearch.toLowerCase())) {
        return false;
      }

      // Apply type filter based on material (barrels are wood)
      if (vesselTypeFilter === "barrel" && vessel.material !== "wood") {
        return false;
      }
      if (vesselTypeFilter === "tank" && vessel.material === "wood") {
        return false;
      }

      return true;
    });
  }, [vesselData?.vessels, vesselSearch, vesselTypeFilter]);

  const handleAssign = () => {
    if (!selectedVesselId) {
      toast({
        title: "Error",
        description: "Please select a vessel",
        variant: "destructive",
      });
      return;
    }

    updateMutation.mutate({
      batchId,
      vesselId: selectedVesselId,
    });
  };

  const selectedVessel = filteredVessels.find((v) => v.id === selectedVesselId);

  // Helper to get display type
  const getVesselType = (material: string | null) => {
    if (material === "wood") return "Barrel";
    return "Tank";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Container className="w-5 h-5 text-blue-600" />
            Assign to Vessel
          </DialogTitle>
          <DialogDescription>
            Assign batch &ldquo;{batchName}&rdquo; to a vessel for aging or storage.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Vessel Type Filter */}
          <div className="space-y-2">
            <Label>Vessel Type</Label>
            <Select value={vesselTypeFilter} onValueChange={setVesselTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="barrel">Barrels</SelectItem>
                <SelectItem value="tank">Tanks</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Vessel Search */}
          <div className="space-y-2">
            <Label>Search Vessels</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by name..."
                value={vesselSearch}
                onChange={(e) => setVesselSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Vessel Selection */}
          <div className="space-y-2">
            <Label>Select Vessel</Label>
            {vesselsLoading ? (
              <div className="text-sm text-gray-500">Loading vessels...</div>
            ) : filteredVessels.length === 0 ? (
              <div className="text-sm text-gray-500">
                No empty vessels available. Try changing filters or emptying a vessel first.
              </div>
            ) : (
              <Select value={selectedVesselId} onValueChange={setSelectedVesselId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a vessel..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredVessels.map((vessel) => (
                    <SelectItem key={vessel.id} value={vessel.id}>
                      {vessel.name || "Unnamed"} ({getVesselType(vessel.material)}) - {vessel.capacity}L capacity
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Selected Vessel Info */}
          {selectedVessel && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm font-medium text-blue-900">
                Selected: {selectedVessel.name || "Unnamed"}
              </p>
              <p className="text-xs text-blue-700">
                Type: {getVesselType(selectedVessel.material)} | Capacity: {selectedVessel.capacity}L
                {selectedVessel.material && ` | Material: ${selectedVessel.material}`}
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={!selectedVesselId || updateMutation.isPending}
          >
            {updateMutation.isPending ? "Assigning..." : "Assign to Vessel"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
