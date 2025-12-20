"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calendar, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateForInput, parseDateInput } from "@/utils/date-format";

interface HarvestDatePickerProps {
  value?: Date | string | null;
  onChange?: (date: Date | null) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  error?: string;
  required?: boolean;
  allowFutureDates?: boolean;
  showClearButton?: boolean;
  id?: string;
}

const HarvestDatePicker = React.forwardRef<
  HTMLInputElement,
  HarvestDatePickerProps
>(
  (
    {
      value,
      onChange,
      label,
      placeholder = "MM/DD/YYYY",
      disabled = false,
      className,
      error,
      required = false,
      allowFutureDates = false,
      showClearButton = true,
      id,
    },
    ref,
  ) => {
    const hiddenInputRef = React.useRef<HTMLInputElement>(null);

    // Convert value to display format (MM/DD/YYYY)
    const displayValue = React.useMemo(() => {
      if (!value) return "";

      try {
        let date: Date;
        if (value instanceof Date) {
          date = value;
        } else {
          const parsed = parseDateInput(value);
          if (!parsed) return "";
          date = parsed;
        }

        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const year = date.getFullYear();
        return `${month}/${day}/${year}`;
      } catch {
        return "";
      }
    }, [value]);

    // Convert value to YYYY-MM-DD for hidden native input
    const nativeValue = React.useMemo(() => {
      if (!value) return "";
      try {
        if (value instanceof Date) {
          return formatDateForInput(value);
        }
        // If already a string, try to parse and reformat
        const parsed = parseDateInput(value);
        if (parsed) {
          return formatDateForInput(parsed);
        }
        return "";
      } catch {
        return "";
      }
    }, [value]);

    // Get today's date for max validation
    const today = formatDateForInput(new Date());

    const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target.value;

      // Allow typing in MM/DD/YYYY format
      let formatted = input.replace(/[^\d/]/g, "");

      // Auto-add slashes
      if (formatted.length === 2 && !formatted.includes("/")) {
        formatted = formatted + "/";
      } else if (formatted.length === 5 && formatted.split("/").length === 2) {
        formatted = formatted + "/";
      }

      // Limit length
      if (formatted.length > 10) {
        formatted = formatted.slice(0, 10);
      }

      // Check if it's a complete valid date
      const match = formatted.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (match) {
        const [, month, day, year] = match;
        const dateStr = `${year}-${month}-${day}`;
        const selectedDate = parseDateInput(dateStr);
        if (selectedDate) {
          // Check if future dates are allowed
          if (!allowFutureDates) {
            const todayAtMidnight = new Date();
            todayAtMidnight.setHours(23, 59, 59, 999);
            if (selectedDate > todayAtMidnight) {
              return;
            }
          }
          onChange?.(selectedDate);
        }
      }
    };

    const handleNativeDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const dateString = e.target.value;

      if (!dateString) {
        onChange?.(null);
        return;
      }

      const selectedDate = parseDateInput(dateString);
      if (!selectedDate) {
        return;
      }

      // Check if future dates are allowed
      if (!allowFutureDates) {
        const todayAtMidnight = new Date();
        todayAtMidnight.setHours(23, 59, 59, 999);
        if (selectedDate > todayAtMidnight) {
          return;
        }
      }

      onChange?.(selectedDate);
    };

    const handleCalendarClick = () => {
      hiddenInputRef.current?.showPicker?.();
    };

    const handleClear = () => {
      onChange?.(null);
    };

    // Get validation error message
    const getValidationError = () => {
      if (error) return error;

      if (required && !displayValue) {
        return "Harvest date is required";
      }

      return null;
    };

    const validationError = getValidationError();

    return (
      <div className={cn("space-y-2", className)}>
        {label && (
          <Label
            htmlFor={id}
            className={cn(
              required && "after:content-['*'] after:text-red-500 after:ml-1",
            )}
          >
            {label}
          </Label>
        )}

        <div className="relative">
          {/* Visible text input showing MM/DD/YYYY */}
          <Input
            ref={ref}
            id={id}
            type="text"
            inputMode="numeric"
            value={displayValue}
            onChange={handleTextChange}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(
              "pr-16",
              validationError &&
                "border-red-500 focus:border-red-500 focus:ring-red-500",
            )}
          />

          {/* Hidden native date input for picker */}
          <input
            ref={hiddenInputRef}
            type="date"
            value={nativeValue}
            onChange={handleNativeDateChange}
            max={allowFutureDates ? undefined : today}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
          />

          {/* Calendar button */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-8 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-gray-100"
            onClick={handleCalendarClick}
            disabled={disabled}
            tabIndex={-1}
          >
            <Calendar className="h-4 w-4 text-gray-400" />
          </Button>

          {/* Clear button */}
          {showClearButton && displayValue && !disabled && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-gray-100 rounded-full"
              onClick={handleClear}
              tabIndex={-1}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Validation error message */}
        {validationError && (
          <p className="text-sm text-red-600 mt-1">{validationError}</p>
        )}
      </div>
    );
  },
);

HarvestDatePicker.displayName = "HarvestDatePicker";

export { HarvestDatePicker };
export type { HarvestDatePickerProps };
