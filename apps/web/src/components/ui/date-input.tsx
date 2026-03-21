"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateForInput, parseDateInput } from "@/utils/date-format";

interface DateInputProps {
  value?: string | Date | null;
  onChange?: (dateString: string) => void;
  onDateChange?: (date: Date | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  max?: string;
  showClearButton?: boolean;
}

/**
 * Custom date input that displays dates in MM/DD/YYYY format
 * regardless of browser locale settings.
 * Supports manual typing with auto-formatting and a native date picker.
 */
export function DateInput({
  value,
  onChange,
  onDateChange,
  placeholder = "MM/DD/YYYY",
  disabled = false,
  className,
  id,
  max,
  showClearButton = true,
}: DateInputProps) {
  const hiddenInputRef = React.useRef<HTMLInputElement>(null);
  // Track partial text input while the user is actively typing
  const [textInput, setTextInput] = React.useState<string | null>(null);
  const [isFocused, setIsFocused] = React.useState(false);

  // Convert value prop to display format (MM/DD/YYYY)
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
      return value;
    } catch {
      return "";
    }
  }, [value]);

  // When the prop-derived displayValue changes (e.g. from calendar pick),
  // clear any partial text input so the field shows the new value
  React.useEffect(() => {
    setTextInput(null);
  }, [displayValue]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;

    // Allow typing in MM/DD/YYYY format with auto-formatting
    let formatted = input.replace(/[^\d/]/g, "");

    // Auto-add slashes after MM and DD
    if (formatted.length === 2 && !formatted.includes("/")) {
      formatted = formatted + "/";
    } else if (formatted.length === 5 && formatted.split("/").length === 2) {
      formatted = formatted + "/";
    }

    // Limit length to MM/DD/YYYY
    if (formatted.length > 10) {
      formatted = formatted.slice(0, 10);
    }

    // Check if it's a complete valid date
    const match = formatted.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) {
      const [, month, day, year] = match;
      const dateStr = `${year}-${month}-${day}`;
      const parsed = parseDateInput(dateStr);
      if (parsed) {
        setTextInput(null); // Clear partial state — displayValue will take over
        onChange?.(dateStr);
        onDateChange?.(parsed);
        return;
      }
    }

    // Store partial input so the user sees what they're typing
    setTextInput(formatted);
  };

  const handleNativeDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateString = e.target.value;
    setTextInput(null);
    if (dateString) {
      onChange?.(dateString);
      const parsed = parseDateInput(dateString);
      onDateChange?.(parsed);
    } else {
      onChange?.("");
      onDateChange?.(null);
    }
  };

  const handleCalendarClick = () => {
    hiddenInputRef.current?.showPicker?.();
  };

  const handleClear = () => {
    setTextInput(null);
    onChange?.("");
    onDateChange?.(null);
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
    // On blur, discard partial input — revert to the last valid value
    setTextInput(null);
  };

  // Show partial text input while typing, otherwise show the prop-derived value
  const shownValue = textInput !== null ? textInput : displayValue;

  return (
    <div className="relative">
      {/* Visible text input showing MM/DD/YYYY */}
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        value={shownValue}
        onChange={handleTextChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          "pr-16",
          className
        )}
      />

      {/* Hidden native date input for picker */}
      <input
        ref={hiddenInputRef}
        type="date"
        value={nativeValue}
        onChange={handleNativeDateChange}
        max={max}
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
      {showClearButton && shownValue && !disabled && (
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
  );
}
