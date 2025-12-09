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
      placeholder = "Select harvest date",
      disabled = false,
      className,
      error,
      required = false,
      allowFutureDates = false,
      showClearButton = true,
      id,
      ...props
    },
    ref,
  ) => {
    // Local state to track input value for text input
    const [inputValue, setInputValue] = React.useState("");

    // Convert value to string format for input
    const dateValue = React.useMemo(() => {
      if (!value) return "";

      try {
        return formatDateForInput(value);
      } catch {
        return "";
      }
    }, [value]);

    // Sync local input state with value prop
    React.useEffect(() => {
      setInputValue(dateValue);
    }, [dateValue]);

    // Get today's date for validation
    const today = formatDateForInput(new Date());

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const dateString = e.target.value;

      // Update local input state immediately for text display
      setInputValue(dateString);

      if (!dateString) {
        onChange?.(null);
        return;
      }

      // Only validate and trigger onChange if we have a complete date string
      if (dateString.length === 10 && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Parse date object from input value using timezone-aware parser
        const selectedDate = parseDateInput(dateString);

        // Validate the date
        if (!selectedDate) {
          return;
        }

        // Check if future dates are allowed
        if (!allowFutureDates) {
          const todayAtMidnight = new Date();
          todayAtMidnight.setHours(23, 59, 59, 999); // End of today
          if (selectedDate > todayAtMidnight) {
            return;
          }
        }

        onChange?.(selectedDate);
      }
    };

    const handleClear = () => {
      setInputValue("");
      onChange?.(null);
    };

    // Get validation error message
    const getValidationError = () => {
      if (error) return error;

      if (required && !inputValue) {
        return "Harvest date is required";
      }

      // Validate format if user has typed something
      if (inputValue && inputValue.length > 0) {
        // Check if format is complete and valid
        if (inputValue.length === 10) {
          if (!inputValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
            return "Invalid date format (use YYYY-MM-DD)";
          }

          const selectedDate = parseDateInput(inputValue);
          if (!selectedDate) {
            return "Invalid date";
          }

          if (!allowFutureDates) {
            const todayAtMidnight = new Date();
            todayAtMidnight.setHours(23, 59, 59, 999); // End of today
            if (selectedDate > todayAtMidnight) {
              return "Harvest date cannot be in the future";
            }
          }
        }
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
          <div className="relative">
            <Input
              ref={ref}
              id={id}
              type="text"
              inputMode="numeric"
              pattern="\d{4}-\d{2}-\d{2}"
              value={inputValue}
              onChange={handleDateChange}
              disabled={disabled}
              placeholder={placeholder || "YYYY-MM-DD"}
              className={cn(
                showClearButton && inputValue && !disabled ? "pr-8" : "", // Make room for clear button only
                validationError &&
                  "border-red-500 focus:border-red-500 focus:ring-red-500",
                className,
              )}
              {...props}
            />

            {/* Clear button */}
            {showClearButton && dateValue && !disabled && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-gray-100 rounded-full"
                onClick={handleClear}
                tabIndex={-1}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
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
