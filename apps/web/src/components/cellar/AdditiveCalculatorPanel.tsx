"use client";

import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface AdditiveCalculatorPanelProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

export function AdditiveCalculatorPanel({
  title,
  icon,
  children,
}: AdditiveCalculatorPanelProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-blue-200 bg-blue-50/30">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium hover:bg-blue-50/50 rounded-t-lg transition-colors"
          >
            <div className="flex items-center gap-2">
              {icon}
              <span>{title}</span>
            </div>
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform",
                isOpen && "rotate-180",
              )}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 px-4">{children}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
