import * as React from "react"
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { TableHead } from "./table"

export type SortDirection = 'asc' | 'desc' | 'none'

export interface SortableHeaderProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  children: React.ReactNode
  sortDirection?: SortDirection
  onSort?: () => void
  align?: 'left' | 'center' | 'right'
  canSort?: boolean
  sortIndex?: number // For multi-column sorting display
  className?: string
}

/**
 * A sortable table header component with visual indicators
 * Supports three-way sorting: none -> asc -> desc -> none
 * Includes keyboard navigation for accessibility
 */
export const SortableHeader = React.forwardRef<HTMLTableCellElement, SortableHeaderProps>(
  ({
    children,
    sortDirection = 'none',
    onSort,
    align = 'left',
    canSort = true,
    sortIndex,
    className,
    onClick,
    onKeyDown,
    ...props
  }, ref) => {

    const handleClick = (event: React.MouseEvent<HTMLTableCellElement>) => {
      if (canSort && onSort) {
        onSort()
      }
      onClick?.(event)
    }

    const handleKeyDown = (event: React.KeyboardEvent<HTMLTableCellElement>) => {
      if (canSort && onSort && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault()
        onSort()
      }
      onKeyDown?.(event)
    }

    const getSortIcon = () => {
      switch (sortDirection) {
        case 'asc':
          return <ArrowUp className="w-4 h-4" />
        case 'desc':
          return <ArrowDown className="w-4 h-4" />
        default:
          return <ArrowUpDown className="w-4 h-4 opacity-50" />
      }
    }

    const getAlignmentClass = () => {
      switch (align) {
        case 'center':
          return 'justify-center'
        case 'right':
          return 'justify-end'
        default:
          return 'justify-start'
      }
    }

    const getSortIndicator = () => {
      if (!canSort) return null

      return (
        <div className="flex items-center gap-1">
          {getSortIcon()}
          {sortIndex !== undefined && sortIndex > 0 && sortDirection !== 'none' && (
            <span className="text-xs font-mono bg-muted text-muted-foreground px-1 rounded">
              {sortIndex + 1}
            </span>
          )}
        </div>
      )
    }

    return (
      <TableHead
        ref={ref}
        className={cn(
          "group transition-colors",
          canSort && [
            "cursor-pointer select-none",
            "hover:bg-muted/50 focus:bg-muted/50",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          ],
          className
        )}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={canSort ? 0 : undefined}
        role={canSort ? "button" : undefined}
        aria-label={canSort ? `Sort by ${children}` : undefined}
        aria-pressed={canSort && sortDirection !== 'none' ? true : undefined}
        aria-sort={canSort ? (
          sortDirection === 'asc' ? 'ascending' :
          sortDirection === 'desc' ? 'descending' :
          'none'
        ) : undefined}
        {...props}
      >
        <div className={cn("flex items-center gap-2", getAlignmentClass())}>
          <span className="truncate">{children}</span>
          {getSortIndicator()}
        </div>
      </TableHead>
    )
  }
)

SortableHeader.displayName = "SortableHeader"

/**
 * Helper function to get sort direction display text for screen readers
 */
export function getSortDirectionText(direction: SortDirection): string {
  switch (direction) {
    case 'asc':
      return 'sorted ascending'
    case 'desc':
      return 'sorted descending'
    default:
      return 'not sorted'
  }
}

/**
 * Hook for managing sort icons and accessibility attributes
 */
export function useSortableHeader(
  sortDirection: SortDirection = 'none',
  field?: string
) {
  const sortLabel = React.useMemo(() => {
    const fieldName = field ? ` by ${field}` : ''
    switch (sortDirection) {
      case 'asc':
        return `Sorted${fieldName} in ascending order`
      case 'desc':
        return `Sorted${fieldName} in descending order`
      default:
        return `Sort${fieldName}`
    }
  }, [sortDirection, field])

  const nextSortDirection = React.useMemo(() => {
    switch (sortDirection) {
      case 'none':
        return 'ascending'
      case 'asc':
        return 'descending'
      case 'desc':
        return 'clear sort'
    }
  }, [sortDirection])

  return {
    sortLabel,
    nextSortDirection,
    isSorted: sortDirection !== 'none'
  }
}