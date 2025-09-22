'use client'

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  flexRender,
} from '@tanstack/react-table'
import { trpc } from '@/utils/trpc'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, ArrowUpDown, Archive, ArchiveRestore } from 'lucide-react'
import { toast } from 'sonner'
import { useDebounce } from '@/hooks/useDebounce'
import {
  getCiderCategoryOptions,
  getIntensityOptions,
  getHarvestWindowOptions,
  getCiderCategoryLabel,
  getIntensityLabel,
  getHarvestWindowLabel,
} from 'lib'
import { SimpleDropdown } from './SimpleDropdown'

interface FruitVariety {
  id: string
  name: string
  fruitType: "apple" | "pear" | "plum"
  isActive: boolean
  ciderCategory: "sweet" | "bittersweet" | "sharp" | "bittersharp" | null
  tannin: "high" | "medium-high" | "medium" | "low-medium" | "low" | null
  acid: "high" | "medium-high" | "medium" | "low-medium" | "low" | null
  sugarBrix: "high" | "medium-high" | "medium" | "low-medium" | "low" | null
  harvestWindow: "very-early" | "early" | "early-mid" | "mid" | "mid-late" | "late" | "very-late" | null
  varietyNotes: string | null
  createdAt: string
  updatedAt: string
}

interface EditingCell {
  rowId: string
  columnId: string
}

interface FruitsGridProps {
  userRole: 'admin' | 'operator' | 'viewer'
}

// Completely isolated cell editor component
class CellEditor extends React.Component<{
  value: any
  columnId: string
  onSave: (value: any) => void
  onCancel: () => void
  options?: ReadonlyArray<{ readonly value: string; readonly label: string }>
}, { localValue: any }> {
  inputRef = React.createRef<HTMLInputElement>()
  textareaRef = React.createRef<HTMLTextAreaElement>()

  constructor(props: any) {
    super(props)
    this.state = {
      localValue: props.value || ''
    }
  }

  componentDidMount() {
    if (this.inputRef.current) {
      this.inputRef.current.focus()
    }
    if (this.textareaRef.current) {
      this.textareaRef.current.focus()
    }
  }

  handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      this.props.onSave(this.state.localValue)
    } else if (e.key === 'Escape') {
      this.props.onCancel()
    }
  }

  handleSelectChange = (newValue: string) => {
    console.log('handleSelectChange called with:', newValue)
    // Always save the change immediately
    if (newValue === '__clear__') {
      console.log('Clearing value')
      this.props.onSave(null)
    } else if (newValue === '') {
      // Don't save empty string
      console.log('Empty value, not saving')
    } else {
      console.log('Saving value:', newValue)
      this.props.onSave(newValue)
    }
  }

  render() {
    const { columnId, options, value } = this.props
    const { localValue } = this.state

    // Textarea for notes
    if (columnId === 'varietyNotes') {
      return (
        <Textarea
          ref={this.textareaRef}
          value={localValue || ''}
          onChange={(e) => this.setState({ localValue: e.target.value })}
          onBlur={() => this.props.onSave(localValue)}
          onKeyDown={this.handleKeyDown}
          className="min-h-[80px] w-full"
        />
      )
    }

    // Select dropdown - using SimpleDropdown component
    if (options && ['fruitType', 'ciderCategory', 'tannin', 'acid', 'sugarBrix', 'harvestWindow'].includes(columnId)) {
      return (
        <SimpleDropdown
          value={value}
          options={options as Array<{ value: string; label: string }>}
          onSave={this.props.onSave}
        />
      )
    }

    // Regular text input
    return (
      <Input
        ref={this.inputRef}
        value={localValue || ''}
        onChange={(e) => this.setState({ localValue: e.target.value })}
        onBlur={() => this.props.onSave(localValue)}
        onKeyDown={this.handleKeyDown}
        className="w-full"
      />
    )
  }
}

// Editable cell wrapper
function EditableCell({
  value,
  rowId,
  columnId,
  userRole,
  isEditing,
  isSaving,
  onStartEdit,
  onSave,
  onCancel,
}: {
  value: any
  rowId: string
  columnId: string
  userRole: 'admin' | 'operator' | 'viewer'
  isEditing: boolean
  isSaving?: boolean
  onStartEdit: () => void
  onSave: (value: any) => void
  onCancel: () => void
}) {
  const getFruitTypeOptions = () => [
    { value: 'apple', label: '🍎 Apple' },
    { value: 'pear', label: '🍐 Pear' },
    { value: 'plum', label: '🟣 Plum' }
  ]

  const getFruitTypeLabel = (value: string) => {
    const option = getFruitTypeOptions().find(opt => opt.value === value)
    return option ? option.label : value
  }

  const getOptions = () => {
    if (columnId === 'fruitType') return getFruitTypeOptions()
    if (columnId === 'ciderCategory') return getCiderCategoryOptions()
    if (columnId === 'harvestWindow') return getHarvestWindowOptions()
    if (['tannin', 'acid', 'sugarBrix'].includes(columnId)) return getIntensityOptions()
    return undefined
  }

  const getDisplayValue = () => {
    if (columnId === 'fruitType') return getFruitTypeLabel(value)
    if (columnId === 'ciderCategory') return getCiderCategoryLabel(value)
    if (['tannin', 'acid', 'sugarBrix'].includes(columnId)) return getIntensityLabel(value)
    if (columnId === 'harvestWindow') return getHarvestWindowLabel(value)
    return value
  }

  if (isEditing) {
    return (
      <CellEditor
        value={value}
        columnId={columnId}
        options={getOptions()}
        onSave={onSave}
        onCancel={onCancel}
      />
    )
  }

  const displayValue = getDisplayValue()

  return (
    <div
      onClick={() => userRole !== 'viewer' && !isSaving && onStartEdit()}
      className={`min-h-[32px] px-2 py-1 rounded transition-colors ${
        userRole === 'viewer' || isSaving
          ? 'cursor-default'
          : 'cursor-pointer hover:bg-gray-50'
      } ${
        isSaving ? 'opacity-60 bg-blue-50' : ''
      }`}
    >
      <div className="flex items-center gap-2">
        {displayValue || <span className="text-gray-400">-</span>}
        {isSaving && (
          <div className="w-3 h-3 border border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        )}
      </div>
    </div>
  )
}

export function FruitsGrid({ userRole }: FruitsGridProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [fruitTypeFilter, setFruitTypeFilter] = useState<string>('all')
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null)
  const [pendingUpdates, setPendingUpdates] = useState<Map<string, Partial<FruitVariety>>>(new Map())
  const [savingCells, setSavingCells] = useState<Set<string>>(new Set())
  const [originalValues, setOriginalValues] = useState<Map<string, any>>(new Map())

  const utils = trpc.useUtils()

  const { data, isLoading } = trpc.fruitVariety.listAll.useQuery({
    includeInactive: true,
  })

  const allVarieties = useMemo(() => data?.appleVarieties || [], [data])

  // Filter varieties by fruit type
  const varieties = useMemo(() => {
    if (fruitTypeFilter === 'all') {
      return allVarieties
    }
    return allVarieties.filter(variety => variety.fruitType === fruitTypeFilter)
  }, [allVarieties, fruitTypeFilter])

  const updateVarietyMutation = trpc.fruitVariety.update.useMutation({
    onSuccess: (data, variables) => {
      utils.fruitVariety.listAll.invalidate()
      toast.success('Variety updated successfully')
      // Clear saving state for this variety
      setSavingCells(prev => {
        const newSet = new Set(prev)
        const cellKey = `${variables.id}`
        newSet.delete(cellKey)
        return newSet
      })
      // Clear pending updates for this variety
      setPendingUpdates(prev => {
        const newMap = new Map(prev)
        newMap.delete(variables.id)
        return newMap
      })
    },
    onError: (error, variables) => {
      toast.error(error.message || 'Failed to update variety')
      // Clear saving state
      setSavingCells(prev => {
        const newSet = new Set(prev)
        const cellKey = `${variables.id}`
        newSet.delete(cellKey)
        return newSet
      })
      // Revert changes by removing from pending updates
      setPendingUpdates(prev => {
        const newMap = new Map(prev)
        newMap.delete(variables.id)
        return newMap
      })
      // Force data refresh to revert UI
      utils.fruitVariety.listAll.invalidate()
    },
  })

  const archiveVariety = trpc.fruitVariety.remove.useMutation({
    onSuccess: () => {
      utils.fruitVariety.listAll.invalidate()
      toast.success('Variety archived successfully')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to archive variety')
    },
  })

  const debouncedUpdates = useDebounce(pendingUpdates, 500)

  // Process debounced updates - DON'T include mutation as dependency
  useEffect(() => {
    if (debouncedUpdates.size > 0) {
      debouncedUpdates.forEach((updates, varietyId) => {
        const patch: any = {}

        // Only include fields that were actually updated
        if (updates.name !== undefined) patch.name = updates.name
        if (updates.fruitType !== undefined) patch.fruitType = updates.fruitType
        if (updates.ciderCategory !== undefined) patch.ciderCategory = updates.ciderCategory
        if (updates.tannin !== undefined) patch.tannin = updates.tannin
        if (updates.acid !== undefined) patch.acid = updates.acid
        if (updates.sugarBrix !== undefined) patch.sugarBrix = updates.sugarBrix
        if (updates.harvestWindow !== undefined) patch.harvestWindow = updates.harvestWindow
        if (updates.varietyNotes !== undefined) patch.varietyNotes = updates.varietyNotes
        if (updates.isActive !== undefined) patch.isActive = updates.isActive

        // Mark this variety as saving
        setSavingCells(prev => new Set(prev).add(varietyId))

        console.log('Sending update:', { id: varietyId, patch })
        updateVarietyMutation.mutate({ id: varietyId, patch })
      })
      // Don't clear pending updates here - let the mutation callbacks handle it
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedUpdates])

  const handleCellSave = useCallback((rowId: string, columnId: string, value: any) => {
    if (userRole === 'viewer') return

    console.log('handleCellSave called:', { rowId, columnId, value })

    setPendingUpdates((prev) => {
      const newUpdates = new Map(prev)
      const existing = newUpdates.get(rowId) || {}
      newUpdates.set(rowId, { ...existing, [columnId]: value })
      console.log('Updated pendingUpdates:', newUpdates)
      return newUpdates
    })
    setEditingCell(null)
  }, [userRole])

  const columns: ColumnDef<FruitVariety>[] = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="h-8 px-2"
          >
            Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ getValue, row, column }) => {
          const columnId = (column.columnDef as any).accessorKey || column.id
          return (
            <EditableCell
              value={getValue()}
              rowId={row.original.id}
              columnId={columnId}
              userRole={userRole}
              isEditing={editingCell?.rowId === row.original.id && editingCell?.columnId === columnId}
              isSaving={savingCells.has(row.original.id)}
              onStartEdit={() => setEditingCell({ rowId: row.original.id, columnId })}
              onSave={(value) => handleCellSave(row.original.id, columnId, value)}
              onCancel={() => setEditingCell(null)}
            />
          )
        },
      },
      {
        accessorKey: 'fruitType',
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="h-8 px-2"
          >
            Type
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ getValue, row, column }) => {
          const columnId = (column.columnDef as any).accessorKey || column.id
          return (
            <EditableCell
              value={getValue()}
              rowId={row.original.id}
              columnId={columnId}
              userRole={userRole}
              isEditing={editingCell?.rowId === row.original.id && editingCell?.columnId === columnId}
              isSaving={savingCells.has(row.original.id)}
              onStartEdit={() => setEditingCell({ rowId: row.original.id, columnId })}
              onSave={(value) => handleCellSave(row.original.id, columnId, value)}
              onCancel={() => setEditingCell(null)}
            />
          )
        },
      },
      {
        accessorKey: 'ciderCategory',
        header: 'Cider Category',
        cell: ({ getValue, row, column }) => {
          const columnId = (column.columnDef as any).accessorKey || column.id
          return (
            <EditableCell
              value={getValue()}
              rowId={row.original.id}
              columnId={columnId}
              userRole={userRole}
              isEditing={editingCell?.rowId === row.original.id && editingCell?.columnId === columnId}
              isSaving={savingCells.has(row.original.id)}
              onStartEdit={() => setEditingCell({ rowId: row.original.id, columnId })}
              onSave={(value) => handleCellSave(row.original.id, columnId, value)}
              onCancel={() => setEditingCell(null)}
            />
          )
        },
      },
      {
        accessorKey: 'tannin',
        header: 'Tannin',
        cell: ({ getValue, row, column }) => {
          const columnId = (column.columnDef as any).accessorKey || column.id
          return (
            <EditableCell
              value={getValue()}
              rowId={row.original.id}
              columnId={columnId}
              userRole={userRole}
              isEditing={editingCell?.rowId === row.original.id && editingCell?.columnId === columnId}
              isSaving={savingCells.has(row.original.id)}
              onStartEdit={() => setEditingCell({ rowId: row.original.id, columnId })}
              onSave={(value) => handleCellSave(row.original.id, columnId, value)}
              onCancel={() => setEditingCell(null)}
            />
          )
        },
      },
      {
        accessorKey: 'acid',
        header: 'Acid',
        cell: ({ getValue, row, column }) => {
          const columnId = (column.columnDef as any).accessorKey || column.id
          return (
            <EditableCell
              value={getValue()}
              rowId={row.original.id}
              columnId={columnId}
              userRole={userRole}
              isEditing={editingCell?.rowId === row.original.id && editingCell?.columnId === columnId}
              isSaving={savingCells.has(row.original.id)}
              onStartEdit={() => setEditingCell({ rowId: row.original.id, columnId })}
              onSave={(value) => handleCellSave(row.original.id, columnId, value)}
              onCancel={() => setEditingCell(null)}
            />
          )
        },
      },
      {
        accessorKey: 'sugarBrix',
        header: 'Sugar Level',
        cell: ({ getValue, row, column }) => {
          const columnId = (column.columnDef as any).accessorKey || column.id
          return (
            <EditableCell
              value={getValue()}
              rowId={row.original.id}
              columnId={columnId}
              userRole={userRole}
              isEditing={editingCell?.rowId === row.original.id && editingCell?.columnId === columnId}
              isSaving={savingCells.has(row.original.id)}
              onStartEdit={() => setEditingCell({ rowId: row.original.id, columnId })}
              onSave={(value) => handleCellSave(row.original.id, columnId, value)}
              onCancel={() => setEditingCell(null)}
            />
          )
        },
      },
      {
        accessorKey: 'harvestWindow',
        header: 'Harvest Window',
        cell: ({ getValue, row, column }) => {
          const columnId = (column.columnDef as any).accessorKey || column.id
          return (
            <EditableCell
              value={getValue()}
              rowId={row.original.id}
              columnId={columnId}
              userRole={userRole}
              isEditing={editingCell?.rowId === row.original.id && editingCell?.columnId === columnId}
              isSaving={savingCells.has(row.original.id)}
              onStartEdit={() => setEditingCell({ rowId: row.original.id, columnId })}
              onSave={(value) => handleCellSave(row.original.id, columnId, value)}
              onCancel={() => setEditingCell(null)}
            />
          )
        },
      },
      {
        accessorKey: 'varietyNotes',
        header: 'Notes',
        cell: ({ getValue, row, column }) => {
          const columnId = (column.columnDef as any).accessorKey || column.id
          return (
            <EditableCell
              value={getValue()}
              rowId={row.original.id}
              columnId={columnId}
              userRole={userRole}
              isEditing={editingCell?.rowId === row.original.id && editingCell?.columnId === columnId}
              isSaving={savingCells.has(row.original.id)}
              onStartEdit={() => setEditingCell({ rowId: row.original.id, columnId })}
              onSave={(value) => handleCellSave(row.original.id, columnId, value)}
              onCancel={() => setEditingCell(null)}
            />
          )
        },
      },
      {
        accessorKey: 'isActive',
        header: 'Status',
        cell: ({ getValue }) => (
          <Badge variant={getValue() ? 'default' : 'secondary'}>
            {getValue() ? 'Active' : 'Archived'}
          </Badge>
        ),
      },
      ...(userRole === 'admin' ? [{
        id: 'actions',
        header: 'Actions',
        cell: ({ row }: { row: any }) => (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              archiveVariety.mutate({
                id: row.original.id
              })
            }}
            disabled={archiveVariety.isPending}
          >
            {row.original.isActive ? (
              <>
                <Archive className="h-4 w-4 mr-1" />
                Archive
              </>
            ) : (
              <>
                <ArchiveRestore className="h-4 w-4 mr-1" />
                Restore
              </>
            )}
          </Button>
        ),
      }] : []),
    ],
    [userRole, archiveVariety, editingCell, handleCellSave, savingCells]
  )

  const table = useReactTable({
    data: varieties as any,
    columns: columns as any,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
  })


  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 bg-gray-200 rounded animate-pulse" />
        <div className="h-64 bg-gray-200 rounded animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search varieties..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="min-w-[160px]">
          <Select value={fruitTypeFilter} onValueChange={setFruitTypeFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="apple">🍎 Apple</SelectItem>
              <SelectItem value="pear">🍐 Pear</SelectItem>
              <SelectItem value="plum">🟣 Plum</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="whitespace-nowrap">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && 'selected'}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="p-0">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    No fruit varieties found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Results Count */}
      <div className="text-sm text-gray-600">
        Showing {table.getFilteredRowModel().rows.length} of {allVarieties.length} varieties
      </div>
    </div>
  )
}