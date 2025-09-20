"use client"

import React, { useState, useCallback } from 'react'
import { Filter, X, MapPin, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem
} from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type {
  FilterCallback,
  InventoryFiltersState,
  MaterialType,
  LocationOption,
  StatusOption
} from '@/types/inventory'
import {
  MATERIAL_TYPE_CONFIG,
  LOCATION_OPTIONS,
  STATUS_OPTIONS
} from '@/types/inventory'

interface InventoryFiltersProps {
  onFiltersChange: FilterCallback
  initialFilters?: Partial<InventoryFiltersState>
  className?: string
  showActiveFilter?: boolean
}

export function InventoryFilters({
  onFiltersChange,
  initialFilters = {},
  className,
  showActiveFilter = true
}: InventoryFiltersProps) {
  const [filters, setFilters] = useState<InventoryFiltersState>({
    materialTypes: [],
    location: 'all',
    status: 'all',
    isActive: true,
    ...initialFilters
  })

  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  // Handle material type toggle
  const handleMaterialTypeToggle = useCallback((materialType: MaterialType) => {
    const newMaterialTypes = filters.materialTypes.includes(materialType)
      ? filters.materialTypes.filter(type => type !== materialType)
      : [...filters.materialTypes, materialType]

    const newFilters = { ...filters, materialTypes: newMaterialTypes }
    setFilters(newFilters)
    onFiltersChange(newFilters)
  }, [filters, onFiltersChange])

  // Handle location change
  const handleLocationChange = useCallback((location: LocationOption) => {
    const newFilters = { ...filters, location }
    setFilters(newFilters)
    onFiltersChange(newFilters)
  }, [filters, onFiltersChange])

  // Handle status change
  const handleStatusChange = useCallback((status: StatusOption) => {
    const newFilters = { ...filters, status }
    setFilters(newFilters)
    onFiltersChange(newFilters)
  }, [filters, onFiltersChange])

  // Handle active filter toggle
  const handleActiveToggle = useCallback(() => {
    const newFilters = { ...filters, isActive: !filters.isActive }
    setFilters(newFilters)
    onFiltersChange(newFilters)
  }, [filters, onFiltersChange])

  // Clear all filters
  const handleClearAll = useCallback(() => {
    const newFilters: InventoryFiltersState = {
      materialTypes: [],
      location: 'all',
      status: 'all',
      isActive: true
    }
    setFilters(newFilters)
    onFiltersChange(newFilters)
    setIsDropdownOpen(false)
  }, [onFiltersChange])

  // Calculate active filter count
  const activeFilterCount = [
    filters.materialTypes.length > 0,
    filters.location !== 'all',
    filters.status !== 'all',
    showActiveFilter && !filters.isActive
  ].filter(Boolean).length

  return (
    <div className={cn("flex flex-col sm:flex-row gap-4", className)}>
      {/* Material Type Filter Buttons */}
      <div className="flex flex-wrap gap-2">
        {Object.values(MATERIAL_TYPE_CONFIG).map((config) => {
          const isActive = filters.materialTypes.includes(config.value)
          return (
            <Button
              key={config.value}
              variant={isActive ? "default" : "outline"}
              size="sm"
              onClick={() => handleMaterialTypeToggle(config.value)}
              className={cn(
                "flex items-center gap-2 transition-all",
                isActive && config.color
              )}
            >
              <span className="text-base">{config.icon}</span>
              <span>{config.label}</span>
              {isActive && (
                <X
                  className="w-3 h-3 ml-1"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleMaterialTypeToggle(config.value)
                  }}
                />
              )}
            </Button>
          )
        })}
      </div>

      {/* Additional Filters Dropdown */}
      <div className="flex items-center gap-2">
        <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <Filter className="w-4 h-4" />
              <span>More Filters</span>
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-80" align="end">
            <DropdownMenuLabel className="flex items-center justify-between">
              <span>Filter Options</span>
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={handleClearAll}>
                  Clear All
                </Button>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            {/* Location Filter as Select outside dropdown for better UX */}
            <div className="p-2 space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4" />
                  Location
                </Label>
                <Select value={filters.location} onValueChange={handleLocationChange}>
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LOCATION_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  Status
                </Label>
                <Select value={filters.status} onValueChange={handleStatusChange}>
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {showActiveFilter && (
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Show only active items</Label>
                  <Button
                    variant={filters.isActive ? "default" : "outline"}
                    size="sm"
                    onClick={handleActiveToggle}
                  >
                    {filters.isActive ? "Active" : "All"}
                  </Button>
                </div>
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Active Filters Display */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.materialTypes.map((materialType) => {
            const config = MATERIAL_TYPE_CONFIG[materialType]
            return (
              <Badge
                key={materialType}
                variant="secondary"
                className="flex items-center gap-1"
              >
                <span>{config.icon}</span>
                <span>{config.label}</span>
                <X
                  className="w-3 h-3 cursor-pointer hover:text-red-500"
                  onClick={() => handleMaterialTypeToggle(materialType)}
                />
              </Badge>
            )
          })}

          {filters.location !== 'all' && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              <span>{LOCATION_OPTIONS.find(opt => opt.value === filters.location)?.label}</span>
              <X
                className="w-3 h-3 cursor-pointer hover:text-red-500"
                onClick={() => handleLocationChange('all')}
              />
            </Badge>
          )}

          {filters.status !== 'all' && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              <span>{STATUS_OPTIONS.find(opt => opt.value === filters.status)?.label}</span>
              <X
                className="w-3 h-3 cursor-pointer hover:text-red-500"
                onClick={() => handleStatusChange('all')}
              />
            </Badge>
          )}

          {showActiveFilter && !filters.isActive && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <span>Showing All Items</span>
              <X
                className="w-3 h-3 cursor-pointer hover:text-red-500"
                onClick={handleActiveToggle}
              />
            </Badge>
          )}
        </div>
      )}
    </div>
  )
}

// Simplified filter component for basic use cases
interface SimpleInventoryFiltersProps {
  onMaterialTypeChange: (materialTypes: MaterialType[]) => void
  selectedMaterialTypes?: MaterialType[]
  className?: string
}

export function SimpleInventoryFilters({
  onMaterialTypeChange,
  selectedMaterialTypes = [],
  className
}: SimpleInventoryFiltersProps) {
  const handleToggle = useCallback((materialType: MaterialType) => {
    const newSelection = selectedMaterialTypes.includes(materialType)
      ? selectedMaterialTypes.filter(type => type !== materialType)
      : [...selectedMaterialTypes, materialType]

    onMaterialTypeChange(newSelection)
  }, [selectedMaterialTypes, onMaterialTypeChange])

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {Object.values(MATERIAL_TYPE_CONFIG).map((config) => {
        const isActive = selectedMaterialTypes.includes(config.value)
        return (
          <Button
            key={config.value}
            variant={isActive ? "default" : "outline"}
            size="sm"
            onClick={() => handleToggle(config.value)}
            className={cn(
              "flex items-center gap-2",
              isActive && config.color
            )}
          >
            <span className="text-base">{config.icon}</span>
            <span>{config.label}</span>
          </Button>
        )
      })}
    </div>
  )
}