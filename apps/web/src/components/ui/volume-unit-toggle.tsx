"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { VolumeUnit } from "@/hooks/use-volume-unit";

interface VolumeUnitToggleProps {
  unit: VolumeUnit;
  onToggle: () => void;
  className?: string;
}

export function VolumeUnitToggle({ unit, onToggle, className }: VolumeUnitToggleProps) {
  return (
    <div className={cn("inline-flex items-center rounded-md border p-0.5", className)}>
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "h-7 px-2 text-xs font-medium rounded-sm",
          unit === "L" && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
        )}
        onClick={() => unit !== "L" && onToggle()}
      >
        Liters
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "h-7 px-2 text-xs font-medium rounded-sm",
          unit === "gal" && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
        )}
        onClick={() => unit !== "gal" && onToggle()}
      >
        Gallons
      </Button>
    </div>
  );
}
