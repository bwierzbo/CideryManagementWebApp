"use client";

import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { BottleModal } from "./bottle-modal";
import { FillKegModal } from "./kegs/FillKegModal";
import { Wine, Beer } from "lucide-react";
import { cn } from "@/lib/utils";

type PackagingType = "bottles" | "kegs";

interface UnifiedPackagingModalProps {
  open: boolean;
  onClose: () => void;
  vesselId: string;
  vesselName: string;
  batchId: string;
  currentVolumeL: number;
  initialType?: PackagingType;
}

/**
 * Unified Packaging Modal - Single entry point for all packaging operations
 *
 * Provides a radio selector to choose between Bottles/Cans or Kegs,
 * then renders the appropriate form workflow.
 */
export function UnifiedPackagingModal({
  open,
  onClose,
  vesselId,
  vesselName,
  batchId,
  currentVolumeL,
  initialType = "bottles",
}: UnifiedPackagingModalProps) {
  const [packagingType, setPackagingType] = useState<PackagingType>(initialType);

  // Reset packaging type when modal closes
  const handleClose = () => {
    setPackagingType(initialType);
    onClose();
  };

  // For nested modals, we render them without the Dialog wrapper
  // and just show their content directly
  if (packagingType === "kegs") {
    return (
      <FillKegModal
        open={open}
        onClose={handleClose}
        vesselId={vesselId}
        vesselName={vesselName}
        batchId={batchId}
        currentVolumeL={currentVolumeL}
        showTypeSelector={true}
        onTypeChange={setPackagingType}
      />
    );
  }

  return (
    <BottleModal
      open={open}
      onClose={handleClose}
      vesselId={vesselId}
      vesselName={vesselName}
      batchId={batchId}
      currentVolumeL={currentVolumeL}
      showTypeSelector={true}
      onTypeChange={setPackagingType}
    />
  );
}

/**
 * Package Type Selector Component
 * Button group for selecting between bottles and kegs
 */
export function PackageTypeSelector({
  value,
  onChange,
  className,
}: {
  value: PackagingType;
  onChange: (value: PackagingType) => void;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label className="text-sm font-medium">Package Type</Label>
      <div className="flex gap-2">
        <Button
          type="button"
          variant={value === "bottles" ? "default" : "outline"}
          onClick={() => onChange("bottles")}
          className="flex-1"
        >
          <Wine className="w-4 h-4 mr-2" />
          Bottles / Cans
        </Button>
        <Button
          type="button"
          variant={value === "kegs" ? "default" : "outline"}
          onClick={() => onChange("kegs")}
          className="flex-1"
        >
          <Beer className="w-4 h-4 mr-2" />
          Kegs
        </Button>
      </div>
    </div>
  );
}
