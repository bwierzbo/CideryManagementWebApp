"use client"

import React from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { MaterialType } from '@/types/inventory'
import { MATERIAL_TYPE_CONFIG } from '@/types/inventory'

interface MaterialTypeIndicatorProps {
  materialType: MaterialType
  variant?: 'default' | 'compact' | 'large'
  showIcon?: boolean
  showLabel?: boolean
  className?: string
}

export function MaterialTypeIndicator({
  materialType,
  variant = 'default',
  showIcon = true,
  showLabel = true,
  className
}: MaterialTypeIndicatorProps) {
  const config = MATERIAL_TYPE_CONFIG[materialType]

  if (!config) {
    return (
      <Badge variant="outline" className={cn("bg-gray-100 text-gray-700", className)}>
        <span className="text-sm">Unknown</span>
      </Badge>
    )
  }

  const sizeClasses = {
    compact: "text-xs px-2 py-0.5",
    default: "text-sm px-2.5 py-1",
    large: "text-base px-3 py-1.5"
  }

  const iconSizes = {
    compact: "text-xs",
    default: "text-sm",
    large: "text-lg"
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        "flex items-center gap-1.5 border",
        config.color,
        sizeClasses[variant],
        "font-medium transition-all duration-200",
        className
      )}
    >
      {showIcon && (
        <span className={cn("flex-shrink-0", iconSizes[variant])}>
          {config.icon}
        </span>
      )}
      {showLabel && (
        <span className="flex-shrink-0">
          {config.label}
        </span>
      )}
    </Badge>
  )
}

// Specialized compact version for table cells
export function CompactMaterialTypeIndicator({
  materialType,
  className
}: {
  materialType: MaterialType
  className?: string
}) {
  return (
    <MaterialTypeIndicator
      materialType={materialType}
      variant="compact"
      className={cn("max-w-fit", className)}
    />
  )
}

// Large version with description for detailed views
export function DetailedMaterialTypeIndicator({
  materialType,
  showDescription = false,
  className
}: {
  materialType: MaterialType
  showDescription?: boolean
  className?: string
}) {
  const config = MATERIAL_TYPE_CONFIG[materialType]

  if (!config) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Badge variant="outline" className="bg-gray-100 text-gray-700">
          <span>Unknown</span>
        </Badge>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <MaterialTypeIndicator
        materialType={materialType}
        variant="large"
      />
      {showDescription && (
        <p className="text-xs text-muted-foreground ml-1">
          {config.description}
        </p>
      )}
    </div>
  )
}

// Icon-only version for very compact displays
export function MaterialTypeIcon({
  materialType,
  size = 'default',
  className
}: {
  materialType: MaterialType
  size?: 'small' | 'default' | 'large'
  className?: string
}) {
  const config = MATERIAL_TYPE_CONFIG[materialType]

  if (!config) {
    return (
      <span className={cn("text-gray-400", className)} title="Unknown material type">
        ❓
      </span>
    )
  }

  const sizeClasses = {
    small: "text-sm",
    default: "text-base",
    large: "text-lg"
  }

  return (
    <span
      className={cn(sizeClasses[size], className)}
      title={`${config.label}: ${config.description}`}
      role="img"
      aria-label={config.label}
    >
      {config.icon}
    </span>
  )
}