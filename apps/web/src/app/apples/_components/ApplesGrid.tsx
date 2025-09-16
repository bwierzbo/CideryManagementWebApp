'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
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
  value: any
}

interface ApplesGridProps {
  userRole: 'admin' | 'operator' | 'viewer'
}

export function ApplesGrid({ userRole }: ApplesGridProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [includeInactive, setIncludeInactive] = useState(false)
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null)
  const [pendingUpdates, setPendingUpdates] = useState<Map<string, Partial<AppleVariety>>>(new Map())

  const editInputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)
  const utils = trpc.useUtils()

  const { data, isLoading } = trpc.appleVariety.listAll.useQuery({
    includeInactive,
  })

  const varieties = data?.appleVarieties || []

  const updateVariety = trpc.appleVariety.update.useMutation({
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

  useEffect(() => {
    if (debouncedUpdates.size > 0) {
      debouncedUpdates.forEach((updates, varietyId) => {
        const patch = {
          name: updates.name,
          ciderCategory: updates.ciderCategory,
          tannin: updates.tannin,
          acid: updates.acid,
          sugarBrix: updates.sugarBrix,
          harvestWindow: updates.harvestWindow,
          varietyNotes: updates.varietyNotes || undefined,
          isActive: updates.isActive,
        }
        updateVariety.mutate({ id: varietyId, patch })
      })
      setPendingUpdates(new Map())
    }
  }, [debouncedUpdates, updateVariety])

  const handleCellEdit = (rowId: string, columnId: string, value: any) => {
    if (userRole === 'viewer') return

    const newUpdates = new Map(pendingUpdates)
    const existing = newUpdates.get(rowId) || {}
    newUpdates.set(rowId, { ...existing, [columnId]: value })
    setPendingUpdates(newUpdates)
    setEditingCell(null)
  }

  const EditableCell = ({
    getValue,
    row,
    column,
    table
  }: {
    getValue: () => any
    row: any
    column: any
    table: any
  }) => {
    const initialValue = getValue()
    const [value, setValue] = useState(initialValue)
    const isEditing = editingCell?.rowId === row.id && editingCell?.columnId === column.id

    useEffect(() => {
      setValue(initialValue)
    }, [initialValue])

    useEffect(() => {
      if (isEditing && editInputRef.current) {
        editInputRef.current.focus()
      }
    }, [isEditing])

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleCellEdit(row.id, column.id, value)
      } else if (e.key === 'Escape') {
        setValue(initialValue)
        setEditingCell(null)
      }
    }

    const handleBlur = () => {
      handleCellEdit(row.id, column.id, value)
    }

    const startEditing = () => {
      if (userRole === 'viewer') return
      setEditingCell({ rowId: row.id, columnId: column.id, value: initialValue })
      setValue(initialValue)
    }

    if (isEditing) {
      if (column.id === 'varietyNotes') {
        return (
          <Textarea
            ref={editInputRef as React.RefObject<HTMLTextAreaElement>}
            value={value || ''}
            onChange={(e) => setValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="min-h-[80px] w-full"
          />
        )
      }

      if (['ciderCategory', 'tannin', 'acid', 'sugarBrix', 'harvestWindow'].includes(column.id)) {
        const options = column.id === 'ciderCategory' ? getCiderCategoryOptions()
          : column.id === 'harvestWindow' ? getHarvestWindowOptions()
          : getIntensityOptions()

        return (
          <Select
            value={value || ''}
            onValueChange={(newValue) => handleCellEdit(row.id, column.id, newValue === '__clear__' ? null : newValue)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__clear__">Clear</SelectItem>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      }


      return (
        <Input
          ref={editInputRef as React.RefObject<HTMLInputElement>}
          value={value || ''}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="w-full"
        />
      )
    }

    const displayValue = column.id === 'ciderCategory' ? getCiderCategoryLabel(value)
      : column.id === 'tannin' || column.id === 'acid' || column.id === 'sugarBrix' ? getIntensityLabel(value)
      : column.id === 'harvestWindow' ? getHarvestWindowLabel(value)
      : value

    return (
      <div
        onClick={startEditing}
        className={`min-h-[32px] px-2 py-1 rounded cursor-pointer hover:bg-gray-50 ${
          userRole === 'viewer' ? 'cursor-default' : ''
        }`}
      >
        {displayValue || <span className="text-gray-400">-</span>}
      </div>
    )
  }

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
        cell: EditableCell,
      },
      {
        accessorKey: 'ciderCategory',
        header: 'Cider Category',
        cell: EditableCell,
        filterFn: (row, id, value) => {
          if (!value) return true
          return row.getValue(id) === value
        },
      },
      {
        accessorKey: 'tannin',
        header: 'Tannin',
        cell: EditableCell,
      },
      {
        accessorKey: 'acid',
        header: 'Acid',
        cell: EditableCell,
      },
      {
        accessorKey: 'sugarBrix',
        header: 'Sugar Level',
        cell: EditableCell,
      },
      {
        accessorKey: 'harvestWindow',
        header: 'Harvest Window',
        cell: EditableCell,
      },
      {
        accessorKey: 'varietyNotes',
        header: 'Notes',
        cell: EditableCell,
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
    [userRole, archiveVariety, EditableCell]
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
          <Select
            value={
              (table.getColumn('ciderCategory')?.getFilterValue() as string) ?? ''
            }
            onValueChange={(value) =>
              table.getColumn('ciderCategory')?.setFilterValue(value === '__all__' ? undefined : value)
            }
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Categories</SelectItem>
              {getCiderCategoryOptions().map((category) => (
                <SelectItem key={category.value} value={category.value}>
                  {category.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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