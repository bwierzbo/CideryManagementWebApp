"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { STEPS } from "./types";

interface StepIndicatorProps {
  currentStep: 1 | 2 | 3 | 4;
  onStepClick?: (step: 1 | 2 | 3 | 4) => void;
  completedSteps?: Set<number>;
}

export function StepIndicator({
  currentStep,
  onStepClick,
  completedSteps = new Set(),
}: StepIndicatorProps) {
  // Allow clicking on completed steps and current step
  const canClick = (stepNumber: number) => {
    return stepNumber <= currentStep || completedSteps.has(stepNumber);
  };

  return (
    <nav aria-label="Progress" className="w-full">
      <ol className="flex items-center justify-between">
        {STEPS.map((step, index) => {
          const isCompleted = step.number < currentStep || completedSteps.has(step.number);
          const isCurrent = step.number === currentStep;
          const isPending = step.number > currentStep && !completedSteps.has(step.number);
          const isLast = index === STEPS.length - 1;

          return (
            <li
              key={step.number}
              className={cn("relative flex-1", !isLast && "pr-4 sm:pr-8")}
            >
              {/* Connector line */}
              {!isLast && (
                <div
                  className={cn(
                    "absolute top-4 left-8 right-0 h-0.5 -translate-y-1/2",
                    isCompleted ? "bg-green-500" : "bg-gray-200"
                  )}
                  aria-hidden="true"
                />
              )}

              {/* Step circle and label */}
              <button
                type="button"
                onClick={() => canClick(step.number) && onStepClick?.(step.number as 1 | 2 | 3 | 4)}
                disabled={!canClick(step.number)}
                className={cn(
                  "group relative flex flex-col items-center",
                  canClick(step.number) ? "cursor-pointer" : "cursor-not-allowed"
                )}
              >
                {/* Circle */}
                <span
                  className={cn(
                    "relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors",
                    isCompleted && "bg-green-500 text-white",
                    isCurrent && "bg-blue-600 text-white ring-4 ring-blue-100",
                    isPending && "bg-gray-100 text-gray-500 border-2 border-gray-300"
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    step.number
                  )}
                </span>

                {/* Label */}
                <span
                  className={cn(
                    "mt-2 text-xs font-medium hidden sm:block",
                    isCompleted && "text-green-600",
                    isCurrent && "text-blue-600",
                    isPending && "text-gray-400"
                  )}
                >
                  {step.title}
                </span>

                {/* Short label for mobile */}
                <span
                  className={cn(
                    "mt-2 text-xs font-medium sm:hidden",
                    isCompleted && "text-green-600",
                    isCurrent && "text-blue-600",
                    isPending && "text-gray-400"
                  )}
                >
                  {step.shortTitle}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
