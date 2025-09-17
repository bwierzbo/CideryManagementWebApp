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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
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

interface AppleVariety {
  id: string
  name: string
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

interface ApplesGridProps {
  userRole: 'admin' | 'operator' | 'viewer'
}

// Completely isolated cell editor component
class CellEditor extends React.Component<{
  value: any
  columnId: string
  onSave: (value: any) => void
  onCancel: () => void
  options?: Array<{ value: string; label: string }>
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
    const finalValue = newValue === '__clear__' ? null : newValue
    this.props.onSave(finalValue)
  }

  render() {
    const { columnId, options } = this.props
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

    // Select dropdown - render directly without state tracking
    if (options && ['ciderCategory', 'tannin', 'acid', 'sugarBrix', 'harvestWindow'].includes(columnId)) {
      return (
        <div className="relative">
          <select
            className="w-full px-3 py-2 border border-input rounded-md bg-background"
            value={localValue || ''}
            onChange={(e) => this.handleSelectChange(e.target.value)}
            onBlur={() => this.props.onCancel()}
            autoFocus
          >
            <option value="">Select...</option>
            <option value="__clear__">Clear</option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
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
  onStartEdit,
  onSave,
  onCancel,
}: {
  value: any
  rowId: string
  columnId: string
  userRole: 'admin' | 'operator' | 'viewer'
  isEditing: boolean
  onStartEdit: () => void
  onSave: (value: any) => void
  onCancel: () => void
}) {
  const getOptions = () => {
    if (columnId === 'ciderCategory') return getCiderCategoryOptions()
    if (columnId === 'harvestWindow') return getHarvestWindowOptions()
    if (['tannin', 'acid', 'sugarBrix'].includes(columnId)) return getIntensityOptions()
    return undefined
  }

  const getDisplayValue = () => {
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
      onClick={() => userRole !== 'viewer' && onStartEdit()}
      className={`min-h-[32px] px-2 py-1 rounded cursor-pointer hover:bg-gray-50 ${
        userRole === 'viewer' ? 'cursor-default' : ''
      }`}
    >
      {displayValue || <span className="text-gray-400">-</span>}
    </div>
  )
}

export function ApplesGrid({ userRole }: ApplesGridProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [includeInactive, setIncludeInactive] = useState(false)
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null)
  const [pendingUpdates, setPendingUpdates] = useState<Map<string, Partial<AppleVariety>>>(new Map())
  const [categoryFilter, setCategoryFilter] = useState<string>('')

  const utils = trpc.useUtils()

  const { data, isLoading } = trpc.appleVariety.listAll.useQuery({
    includeInactive,
  })

  const varieties = data?.appleVarieties || []

  const updateVarietyMutation = trpc.appleVariety.update.useMutation({
    onSuccess: () => {
      utils.appleVariety.listAll.invalidate()
      toast.success('Variety updated successfully')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update variety')
    },
  })

  const archiveVariety = trpc.appleVariety.remove.useMutation({
    onSuccess: () => {
      utils.appleVariety.listAll.invalidate()
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
        if (updates.ciderCategory !== undefined) patch.ciderCategory = updates.ciderCategory
        if (updates.tannin !== undefined) patch.tannin = updates.tannin
        if (updates.acid !== undefined) patch.acid = updates.acid
        if (updates.sugarBrix !== undefined) patch.sugarBrix = updates.sugarBrix
        if (updates.harvestWindow !== undefined) patch.harvestWindow = updates.harvestWindow
        if (updates.varietyNotes !== undefined) patch.varietyNotes = updates.varietyNotes || undefined
        if (updates.isActive !== undefined) patch.isActive = updates.isActive

        console.log('Sending update:', { id: varietyId, patch })
        updateVarietyMutation.mutate({ id: varietyId, patch })
      })
      setPendingUpdates(new Map())
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

  const columns: ColumnDef<AppleVariety>[] = useMemo(
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
              onStartEdit={() => setEditingCell({ rowId: row.original.id, columnId })}
              onSave={(value) => handleCellSave(row.original.id, columnId, value)}
              onCancel={() => setEditingCell(null)}
            />
          )
        },
        filterFn: (row, id, value) => {
          if (!value) return true
          return row.getValue(id) === value
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
        filterFn: (row, id, value) => {
          if (value === 'all') return true
          return value === 'active' ? row.getValue(id) : !row.getValue(id)
        },
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
    [userRole, archiveVariety, editingCell, handleCellSave]
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

  // Update table filter when category filter changes
  useEffect(() => {
    const column = table.getColumn('ciderCategory')
    if (column) {
      column.setFilterValue(categoryFilter === '__all__' || categoryFilter === '' ? undefined : categoryFilter)
    }
  }, [categoryFilter, table])

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
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search varieties..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          {/* Use native select to avoid Select component issues */}
          <select
            className="w-40 px-3 py-2 border border-input rounded-md bg-background text-sm"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">All Categories</option>
            {getCiderCategoryOptions().map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
          <Button
            variant={includeInactive ? 'default' : 'outline'}
            onClick={() => setIncludeInactive(!includeInactive)}
            size="sm"
          >
            {includeInactive ? 'All' : 'Active Only'}
          </Button>
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
                    No apple varieties found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Results Count */}
      <div className="text-sm text-gray-600">
        Showing {table.getFilteredRowModel().rows.length} of {varieties.length} varieties
      </div>
    </div>
  )
}