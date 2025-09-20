import { useState, useCallback, useMemo } from 'react'

export type SortDirection = 'asc' | 'desc' | null

export interface SortColumn<T extends string = string> {
  field: T
  direction: SortDirection
}

export interface SortState<T extends string = string> {
  columns: SortColumn<T>[]
  primaryColumn: SortColumn<T> | null
}

export interface UseTableSortingOptions<T extends string = string> {
  multiColumn?: boolean
  defaultSort?: SortColumn<T>
}

export interface UseTableSortingReturn<T extends string = string> {
  sortState: SortState<T>
  handleSort: (field: T, forceDirection?: SortDirection) => void
  getSortDirection: (field: T) => SortDirection
  getSortIcon: (field: T) => 'asc' | 'desc' | 'none'
  clearSort: (field?: T) => void
  clearAllSort: () => void
  sortData: <D>(data: D[], getSortValue?: (item: D, field: T) => any) => D[]
}

/**
 * Reusable hook for managing table sorting state and operations
 * Supports both single and multi-column sorting with three-way state cycling
 */
export function useTableSorting<T extends string = string>({
  multiColumn = false,
  defaultSort
}: UseTableSortingOptions<T> = {}): UseTableSortingReturn<T> {

  const [sortState, setSortState] = useState<SortState<T>>(() => {
    const initialColumns = defaultSort ? [defaultSort] : []
    return {
      columns: initialColumns,
      primaryColumn: initialColumns[0] || null
    }
  })

  /**
   * Handle sorting for a specific field
   * Cycles through: none -> asc -> desc -> none (for single column)
   * For multi-column: manages secondary sorts
   */
  const handleSort = useCallback((field: T, forceDirection?: SortDirection) => {
    setSortState(prev => {
      const existingColumnIndex = prev.columns.findIndex(col => col.field === field)

      if (forceDirection !== undefined) {
        // Force specific direction
        if (forceDirection === null) {
          // Remove the column from sort
          const newColumns = prev.columns.filter(col => col.field !== field)
          return {
            columns: newColumns,
            primaryColumn: newColumns[0] || null
          }
        } else {
          // Set or update to specific direction
          const newColumn: SortColumn<T> = { field, direction: forceDirection }
          if (existingColumnIndex >= 0) {
            const newColumns = [...prev.columns]
            newColumns[existingColumnIndex] = newColumn
            return {
              columns: newColumns,
              primaryColumn: multiColumn ? prev.primaryColumn : newColumn
            }
          } else {
            const newColumns = multiColumn ? [...prev.columns, newColumn] : [newColumn]
            return {
              columns: newColumns,
              primaryColumn: newColumn
            }
          }
        }
      }

      if (existingColumnIndex >= 0) {
        // Column exists - cycle through directions
        const currentColumn = prev.columns[existingColumnIndex]
        let newDirection: SortDirection = null

        if (currentColumn.direction === null || currentColumn.direction === 'desc') {
          newDirection = 'asc'
        } else if (currentColumn.direction === 'asc') {
          newDirection = 'desc'
        }

        if (newDirection === null) {
          // Remove column from sort
          const newColumns = prev.columns.filter(col => col.field !== field)
          return {
            columns: newColumns,
            primaryColumn: newColumns[0] || null
          }
        } else {
          // Update direction
          const newColumns = [...prev.columns]
          const updatedColumn: SortColumn<T> = { field, direction: newDirection }
          newColumns[existingColumnIndex] = updatedColumn

          return {
            columns: newColumns,
            primaryColumn: multiColumn ? prev.primaryColumn : updatedColumn
          }
        }
      } else {
        // New column - start with ascending
        const newColumn: SortColumn<T> = { field, direction: 'asc' }

        if (multiColumn) {
          return {
            columns: [...prev.columns, newColumn],
            primaryColumn: prev.primaryColumn || newColumn
          }
        } else {
          return {
            columns: [newColumn],
            primaryColumn: newColumn
          }
        }
      }
    })
  }, [multiColumn])

  /**
   * Get the current sort direction for a field
   */
  const getSortDirection = useCallback((field: T): SortDirection => {
    const column = sortState.columns.find(col => col.field === field)
    return column?.direction || null
  }, [sortState.columns])

  /**
   * Get the sort icon state for a field
   */
  const getSortIcon = useCallback((field: T): 'asc' | 'desc' | 'none' => {
    const direction = getSortDirection(field)
    return direction || 'none'
  }, [getSortDirection])

  /**
   * Clear sorting for a specific field
   */
  const clearSort = useCallback((field?: T) => {
    if (field) {
      setSortState(prev => {
        const newColumns = prev.columns.filter(col => col.field !== field)
        return {
          columns: newColumns,
          primaryColumn: newColumns[0] || null
        }
      })
    }
  }, [])

  /**
   * Clear all sorting
   */
  const clearAllSort = useCallback(() => {
    setSortState({
      columns: [],
      primaryColumn: null
    })
  }, [])

  /**
   * Sort data based on current sort state
   */
  const sortData = useCallback(<D,>(
    data: D[],
    getSortValue?: (item: D, field: T) => any
  ): D[] => {
    if (sortState.columns.length === 0) return data

    return [...data].sort((a, b) => {
      // Sort by each column in order (primary first)
      for (const column of sortState.columns) {
        if (!column.direction) continue

        let aValue: any
        let bValue: any

        if (getSortValue) {
          aValue = getSortValue(a, column.field)
          bValue = getSortValue(b, column.field)
        } else {
          // Default: try to access the field directly
          aValue = (a as any)[column.field]
          bValue = (b as any)[column.field]
        }

        // Handle null/undefined values
        if (aValue == null && bValue == null) continue
        if (aValue == null) return 1
        if (bValue == null) return -1

        // Handle different data types
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          aValue = aValue.toLowerCase()
          bValue = bValue.toLowerCase()
        } else if (aValue instanceof Date || bValue instanceof Date) {
          aValue = new Date(aValue).getTime()
          bValue = new Date(bValue).getTime()
        }

        // Compare values
        let comparison = 0
        if (aValue < bValue) comparison = -1
        else if (aValue > bValue) comparison = 1

        if (comparison !== 0) {
          return column.direction === 'asc' ? comparison : -comparison
        }
      }

      return 0
    })
  }, [sortState])

  return {
    sortState,
    handleSort,
    getSortDirection,
    getSortIcon,
    clearSort,
    clearAllSort,
    sortData
  }
}