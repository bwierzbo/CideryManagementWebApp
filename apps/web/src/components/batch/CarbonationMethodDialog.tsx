"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Gauge, Beaker } from "lucide-react";

interface CarbonationMethodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectMethod: (method: "forced" | "bottle_conditioning") => void;
}

export function CarbonationMethodDialog({
  open,
  onOpenChange,
  onSelectMethod,
}: CarbonationMethodDialogProps) {
  const handleSelect = (method: "forced" | "bottle_conditioning") => {
    onSelectMethod(method);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Choose Carbonation Method</DialogTitle>
          <DialogDescription>
            Select how you want to carbonate your cider
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
          {/* Forced Carbonation */}
          <Card
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={() => handleSelect("forced")}
          >
            <CardHeader>
              <div className="flex items-center gap-2">
                <Gauge className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Forced Carbonation</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <CardDescription className="text-sm">
                Use CO2 gas and pressure to carbonate in a pressure-rated vessel.
                Fast and precise control of carbonation levels.
              </CardDescription>
              <div className="text-xs text-muted-foreground space-y-1">
                <div>✓ Ready in 1-3 days</div>
                <div>✓ Precise carbonation control</div>
                <div>✓ Requires pressure vessel</div>
              </div>
              <Button className="w-full mt-4" variant="default">
                Use Forced Carbonation
              </Button>
            </CardContent>
          </Card>

          {/* Bottle Conditioning */}
          <Card
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={() => handleSelect("bottle_conditioning")}
          >
            <CardHeader>
              <div className="flex items-center gap-2">
                <Beaker className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Bottle Conditioning</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <CardDescription className="text-sm">
                Add priming sugar before bottling for natural carbonation from residual yeast.
                Traditional method used in brewing.
              </CardDescription>
              <div className="text-xs text-muted-foreground space-y-1">
                <div>✓ Natural carbonation</div>
                <div>✓ No special equipment needed</div>
                <div>✓ Takes 2-4 weeks to condition</div>
              </div>
              <Button className="w-full mt-4" variant="default">
                Use Bottle Conditioning
              </Button>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
