"use client";

import * as React from "react";
import { Input } from "./input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";
import { cn } from "@/lib/utils";

// Note: Includes all units from schema unitEnum, though vessels typically use volume units
export type VolumeUnit = "L" | "gal" | "oz" | "ml" | "kg" | "lb" | "bushel";

interface VolumeInputProps {
  value?: number;
  unit?: VolumeUnit;
  onValueChange?: (value: number | undefined) => void;
  onUnitChange?: (unit: VolumeUnit) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  min?: number;
  max?: number;
  step?: number;
  required?: boolean;
  showUnitSelector?: boolean;
  id?: string;
  name?: string;
}

export function VolumeInput({
  value,
  unit = "L",
  onValueChange,
  onUnitChange,
  placeholder = "Enter volume",
  disabled = false,
  className,
  min = 0,
  max,
  step = 0.1,
  required = false,
  showUnitSelector = true,
  id,
  name,
}: VolumeInputProps) {
  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value ? parseFloat(e.target.value) : undefined;
    onValueChange?.(newValue);
  };

  return (
    <div className={cn("flex gap-2", className)}>
      <Input
        id={id}
        name={name}
        type="number"
        value={value ?? ""}
        onChange={handleValueChange}
        placeholder={placeholder}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        required={required}
        className="flex-1"
      />
      {showUnitSelector && (
        <Select
          value={unit}
          onValueChange={(value) => onUnitChange?.(value as VolumeUnit)}
          disabled={disabled}
        >
          <SelectTrigger className="w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="L">Liters</SelectItem>
            <SelectItem value="gal">Gallons</SelectItem>
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

/**
 * Format volume with unit for display
 */
export function formatVolumeWithUnit(
  value: number | null | undefined,
  unit: VolumeUnit = "L"
): string {
  if (value == null) return "—";

  const formatted = value.toFixed(2);
  return unit === "gal" ? `${formatted} gal` : `${formatted} L`;
}

/**
 * Display component for showing volume with unit
 */
interface VolumeDisplayProps {
  value?: number | null;
  unit?: VolumeUnit;
  className?: string;
  showUnit?: boolean;
}

export function VolumeDisplay({
  value,
  unit = "L",
  className,
  showUnit = true,
}: VolumeDisplayProps) {
  if (value == null) {
    return <span className={cn("text-muted-foreground", className)}>—</span>;
  }

  const displayValue = value.toFixed(2);
  const unitDisplay = unit || "L";

  return (
    <span className={className}>
      {displayValue}
      {showUnit && <span className="ml-1 text-muted-foreground">{unitDisplay}</span>}
    </span>
  );
}