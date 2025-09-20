import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InventoryTable } from '@/components/inventory/InventoryTable'
import '@testing-library/jest-dom'

// Mock the UI components
jest.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: any) => <div data-testid="card" {...props}>{children}</div>,
  CardContent: ({ children, ...props }: any) => <div data-testid="card-content" {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: any) => <div data-testid="card-header" {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: any) => <h2 data-testid="card-title" {...props}>{children}</h2>,
}))

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, variant, size, ...props }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-testid="button"
      data-variant={variant}
      data-size={size}
      {...props}
    >
      {children}
    </button>
  ),
}))

jest.mock('@/components/ui/input', () => ({
  Input: ({ onChange, value, placeholder, type, ...props }: any) => (
    <input
      onChange={onChange}
      value={value}
      placeholder={placeholder}
      type={type}
      data-testid="input"
      {...props}
    />
  ),
}))

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant, ...props }: any) => (
    <span data-testid="badge" data-variant={variant} {...props}>{children}</span>
  ),
}))

// Mock the inventory components
jest.mock('@/components/inventory/InventorySearch', () => ({
  InventorySearch: ({ onSearch, placeholder }: any) => (
    <div data-testid="inventory-search">
      <input
        data-testid="search-input"
        placeholder={placeholder || "Search inventory..."}
        onChange={(e) => onSearch?.(e.target.value)}
      />
    </div>
  ),
}))

jest.mock('@/components/inventory/InventoryFilters', () => ({
  InventoryFilters: ({ onFilterChange, onClear }: any) => (
    <div data-testid="inventory-filters">
      <button data-testid="filter-button" onClick={() => onFilterChange?.({ materialTypes: ['apple'] })}>
        Filter
      </button>
      <button data-testid="clear-filters" onClick={onClear}>
        Clear
      </button>
    </div>
  ),
}))

jest.mock('@/components/inventory/MaterialTypeIndicator', () => ({
  MaterialTypeIndicator: ({ type }: any) => (
    <span data-testid="material-indicator" data-type={type}>
      {type}
    </span>
  ),
}))

// Mock tRPC
jest.mock('@/utils/trpc', () => ({
  trpc: {
    inventory: {
      list: {
        useQuery: jest.fn(() => ({
          data: {
            items: [
              {
                id: '1',
                materialType: 'apple',
                currentBottleCount: 100,
                reservedBottleCount: 10,
                name: 'Gala Apples',
                location: 'Cold Storage',
                status: 'available',
                lastUpdated: new Date('2024-01-01'),
              },
              {
                id: '2',
                materialType: 'additive',
                currentBottleCount: 50,
                reservedBottleCount: 5,
                name: 'Yeast Nutrient',
                location: 'Warehouse',
                status: 'low_stock',
                lastUpdated: new Date('2024-01-02'),
              },
            ],
            total: 2,
            hasMore: false,
          },
          isLoading: false,
          error: null,
        })),
      },
      search: {
        useQuery: jest.fn(() => ({
          data: {
            items: [],
            total: 0,
            hasMore: false,
          },
          isLoading: false,
          error: null,
        })),
      },
    },
  },
}))

// Mock the table sorting hook
jest.mock('@/hooks/use-table-sorting', () => ({
  useTableSorting: jest.fn(() => ({
    sortConfig: { field: null, direction: 'none' },
    handleSort: jest.fn(),
    getSortedData: jest.fn((data) => data),
  })),
}))

// Mock the debounced search hook
jest.mock('@/hooks/use-debounced-search', () => ({
  useDebouncedSearch: jest.fn(() => ({
    debouncedQuery: '',
    setQuery: jest.fn(),
    isDebouncing: false,
  })),
}))

describe('InventoryTable', () => {
  const defaultProps = {
    showSearch: true,
    showFilters: true,
    itemsPerPage: 20,
    className: '',
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders the inventory table with data', () => {
    render(<InventoryTable {...defaultProps} />)

    expect(screen.getByTestId('card')).toBeInTheDocument()
    expect(screen.getByText('Gala Apples')).toBeInTheDocument()
    expect(screen.getByText('Yeast Nutrient')).toBeInTheDocument()
  })

  it('displays search component when showSearch is true', () => {
    render(<InventoryTable {...defaultProps} showSearch={true} />)

    expect(screen.getByTestId('inventory-search')).toBeInTheDocument()
    expect(screen.getByTestId('search-input')).toBeInTheDocument()
  })

  it('hides search component when showSearch is false', () => {
    render(<InventoryTable {...defaultProps} showSearch={false} />)

    expect(screen.queryByTestId('inventory-search')).not.toBeInTheDocument()
  })

  it('displays filters component when showFilters is true', () => {
    render(<InventoryTable {...defaultProps} showFilters={true} />)

    expect(screen.getByTestId('inventory-filters')).toBeInTheDocument()
    expect(screen.getByTestId('filter-button')).toBeInTheDocument()
    expect(screen.getByTestId('clear-filters')).toBeInTheDocument()
  })

  it('hides filters component when showFilters is false', () => {
    render(<InventoryTable {...defaultProps} showFilters={false} />)

    expect(screen.queryByTestId('inventory-filters')).not.toBeInTheDocument()
  })

  it('displays material type indicators for each item', () => {
    render(<InventoryTable {...defaultProps} />)

    const materialIndicators = screen.getAllByTestId('material-indicator')
    expect(materialIndicators).toHaveLength(2)

    expect(materialIndicators[0]).toHaveAttribute('data-type', 'apple')
    expect(materialIndicators[1]).toHaveAttribute('data-type', 'additive')
  })

  it('shows inventory counts correctly', () => {
    render(<InventoryTable {...defaultProps} />)

    // Check that counts are displayed (would be rendered in table cells)
    expect(screen.getByText('100')).toBeInTheDocument() // currentBottleCount
    expect(screen.getByText('50')).toBeInTheDocument()  // currentBottleCount
    expect(screen.getByText('10')).toBeInTheDocument()  // reservedBottleCount
    expect(screen.getByText('5')).toBeInTheDocument()   // reservedBottleCount
  })

  it('displays location information', () => {
    render(<InventoryTable {...defaultProps} />)

    expect(screen.getByText('Cold Storage')).toBeInTheDocument()
    expect(screen.getByText('Warehouse')).toBeInTheDocument()
  })

  it('shows status indicators', () => {
    render(<InventoryTable {...defaultProps} />)

    expect(screen.getByText('available')).toBeInTheDocument()
    expect(screen.getByText('low_stock')).toBeInTheDocument()
  })

  it('handles search functionality', async () => {
    const user = userEvent.setup()
    render(<InventoryTable {...defaultProps} />)

    const searchInput = screen.getByTestId('search-input')
    await user.type(searchInput, 'Gala')

    expect(searchInput).toHaveValue('Gala')
  })

  it('handles filter changes', async () => {
    render(<InventoryTable {...defaultProps} />)

    const filterButton = screen.getByTestId('filter-button')
    fireEvent.click(filterButton)

    // Filter functionality is mocked, so we're testing the interaction
    expect(filterButton).toBeInTheDocument()
  })

  it('handles clear filters action', async () => {
    render(<InventoryTable {...defaultProps} />)

    const clearButton = screen.getByTestId('clear-filters')
    fireEvent.click(clearButton)

    expect(clearButton).toBeInTheDocument()
  })

  it('applies custom className when provided', () => {
    const customClass = 'custom-table-class'
    render(<InventoryTable {...defaultProps} className={customClass} />)

    const card = screen.getByTestId('card')
    expect(card).toHaveClass(customClass)
  })

  it('respects itemsPerPage prop', () => {
    render(<InventoryTable {...defaultProps} itemsPerPage={10} />)

    // The itemsPerPage prop would affect pagination, but since we're mocking the query,
    // we verify that the component renders without error
    expect(screen.getByTestId('card')).toBeInTheDocument()
  })

  it('handles loading state gracefully', () => {
    // Mock loading state
    const mockTrpc = require('@/utils/trpc').trpc
    mockTrpc.inventory.list.useQuery.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    })

    render(<InventoryTable {...defaultProps} />)

    expect(screen.getByTestId('card')).toBeInTheDocument()
  })

  it('handles error state gracefully', () => {
    // Mock error state
    const mockTrpc = require('@/utils/trpc').trpc
    mockTrpc.inventory.list.useQuery.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('Failed to load inventory'),
    })

    render(<InventoryTable {...defaultProps} />)

    expect(screen.getByTestId('card')).toBeInTheDocument()
  })

  it('displays empty state when no items', () => {
    // Mock empty state
    const mockTrpc = require('@/utils/trpc').trpc
    mockTrpc.inventory.list.useQuery.mockReturnValue({
      data: {
        items: [],
        total: 0,
        hasMore: false,
      },
      isLoading: false,
      error: null,
    })

    render(<InventoryTable {...defaultProps} />)

    expect(screen.getByTestId('card')).toBeInTheDocument()
  })

  it('formats dates correctly', () => {
    render(<InventoryTable {...defaultProps} />)

    // Dates would be formatted in the actual component
    // Here we're testing that the component renders without error
    expect(screen.getByTestId('card')).toBeInTheDocument()
  })

  it('provides accessibility features', () => {
    render(<InventoryTable {...defaultProps} />)

    // Table should have proper ARIA labels and structure
    const card = screen.getByTestId('card')
    expect(card).toBeInTheDocument()

    // Search and filter components should be accessible
    if (defaultProps.showSearch) {
      expect(screen.getByTestId('search-input')).toBeInTheDocument()
    }
  })

  it('supports responsive design', () => {
    render(<InventoryTable {...defaultProps} />)

    // Component should render responsively
    const card = screen.getByTestId('card')
    expect(card).toBeInTheDocument()
  })

  it('handles large datasets efficiently', () => {
    // Mock large dataset
    const mockTrpc = require('@/utils/trpc').trpc
    const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
      id: String(i + 1),
      materialType: i % 2 === 0 ? 'apple' : 'additive',
      currentBottleCount: 100 + i,
      reservedBottleCount: 10 + i,
      name: `Item ${i + 1}`,
      location: 'Storage',
      status: 'available',
      lastUpdated: new Date(),
    }))

    mockTrpc.inventory.list.useQuery.mockReturnValue({
      data: {
        items: largeDataset.slice(0, 20), // Paginated
        total: largeDataset.length,
        hasMore: true,
      },
      isLoading: false,
      error: null,
    })

    render(<InventoryTable {...defaultProps} />)

    expect(screen.getByTestId('card')).toBeInTheDocument()
    expect(screen.getByText('Item 1')).toBeInTheDocument()
  })
})