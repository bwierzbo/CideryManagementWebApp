"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Calendar, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface HarvestDatePickerProps {
  value?: Date | string | null
  onChange?: (date: Date | null) => void
  label?: string
  placeholder?: string
  disabled?: boolean
  className?: string
  error?: string
  required?: boolean
  allowFutureDates?: boolean
  showClearButton?: boolean
  id?: string
}

const HarvestDatePicker = React.forwardRef<HTMLInputElement, HarvestDatePickerProps>(
  ({
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
  }, ref) => {
    // Convert value to string format for input
    const dateValue = React.useMemo(() => {
      if (!value) return ""

      if (typeof value === "string") {
        // If it's already a string, try to parse and format
        const date = new Date(value)
        if (isNaN(date.getTime())) return ""
        return date.toISOString().split('T')[0]
      }

      if (value instanceof Date) {
        if (isNaN(value.getTime())) return ""
        return value.toISOString().split('T')[0]
      }

      return ""
    }, [value])

    // Get today's date for validation
    const today = new Date().toISOString().split('T')[0]

    // Set max date if future dates are not allowed
    const maxDate = allowFutureDates ? undefined : today

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const dateString = e.target.value

      if (!dateString) {
        onChange?.(null)
        return
      }

      // Create date object from input value
      const selectedDate = new Date(dateString + "T12:00:00") // Add noon time to avoid timezone issues

      // Validate the date
      if (isNaN(selectedDate.getTime())) {
        onChange?.(null)
        return
      }

      // Check if future dates are allowed
      if (!allowFutureDates) {
        const todayAtMidnight = new Date()
        todayAtMidnight.setHours(23, 59, 59, 999) // End of today
        if (selectedDate > todayAtMidnight) {
          onChange?.(null)
          return
        }
      }

      onChange?.(selectedDate)
    }

    const handleClear = () => {
      onChange?.(null)
    }

    // Get validation error message
    const getValidationError = () => {
      if (error) return error

      if (required && !dateValue) {
        return "Harvest date is required"
      }

      if (dateValue && !allowFutureDates) {
        const selectedDate = new Date(dateValue + "T12:00:00")
        const todayAtMidnight = new Date()
        todayAtMidnight.setHours(23, 59, 59, 999) // End of today
        if (selectedDate > todayAtMidnight) {
          return "Harvest date cannot be in the future"
        }
      }

      return null
    }

    const validationError = getValidationError()

    return (
      <div className={cn("space-y-2", className)}>
        {label && (
          <Label htmlFor={id} className={cn(
            required && "after:content-['*'] after:text-red-500 after:ml-1"
          )}>
            {label}
          </Label>
        )}

        <div className="relative">
          <div className="relative">
            <Input
              ref={ref}
              id={id}
              type="date"
              value={dateValue}
              onChange={handleDateChange}
              disabled={disabled}
              max={maxDate}
              placeholder={placeholder}
              className={cn(
                showClearButton && dateValue && !disabled ? "pr-8" : "", // Make room for clear button only
                validationError && "border-red-500 focus:border-red-500 focus:ring-red-500",
                className
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
    )
  }
)

HarvestDatePicker.displayName = "HarvestDatePicker"

export { HarvestDatePicker }
export type { HarvestDatePickerProps }