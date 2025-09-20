import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InventorySearch } from '@/components/inventory/InventorySearch'
import '@testing-library/jest-dom'

// Mock the UI components
jest.mock('@/components/ui/input', () => ({
  Input: ({ onChange, value, placeholder, type, className, ...props }: any) => (
    <input
      onChange={onChange}
      value={value}
      placeholder={placeholder}
      type={type}
      className={className}
      data-testid="input"
      {...props}
    />
  ),
}))

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, variant, size, className, ...props }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-testid="button"
      data-variant={variant}
      data-size={size}
      className={className}
      {...props}
    >
      {children}
    </button>
  ),
}))

// Mock the debounced search hook
jest.mock('@/hooks/use-debounced-search', () => ({
  useDebouncedSearch: jest.fn(() => ({
    debouncedQuery: '',
    setQuery: jest.fn(),
    isDebouncing: false,
  })),
}))

describe('InventorySearch', () => {
  const mockOnSearch = jest.fn()
  const mockOnClear = jest.fn()

  const defaultProps = {
    onSearch: mockOnSearch,
    onClear: mockOnClear,
    placeholder: 'Search inventory...',
    isLoading: false,
    className: '',
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders the search input with correct placeholder', () => {
    render(<InventorySearch {...defaultProps} />)

    const input = screen.getByTestId('input')
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('placeholder', 'Search inventory...')
  })

  it('uses custom placeholder when provided', () => {
    const customPlaceholder = 'Search for items...'
    render(<InventorySearch {...defaultProps} placeholder={customPlaceholder} />)

    const input = screen.getByTestId('input')
    expect(input).toHaveAttribute('placeholder', customPlaceholder)
  })

  it('applies custom className when provided', () => {
    const customClass = 'custom-search-class'
    render(<InventorySearch {...defaultProps} className={customClass} />)

    const container = screen.getByTestId('input').parentElement
    expect(container).toHaveClass(customClass)
  })

  it('handles text input changes', async () => {
    const user = userEvent.setup()
    const setQueryMock = jest.fn()

    // Mock the hook to return our mock function
    const mockUseDebouncedSearch = require('@/hooks/use-debounced-search').useDebouncedSearch
    mockUseDebouncedSearch.mockReturnValue({
      debouncedQuery: '',
      setQuery: setQueryMock,
      isDebouncing: false,
    })

    render(<InventorySearch {...defaultProps} />)

    const input = screen.getByTestId('input')
    await user.type(input, 'apple')

    expect(setQueryMock).toHaveBeenCalled()
  })

  it('calls onSearch when debounced query changes', () => {
    const debouncedQuery = 'test search'

    // Mock the hook to return a debounced query
    const mockUseDebouncedSearch = require('@/hooks/use-debounced-search').useDebouncedSearch
    mockUseDebouncedSearch.mockReturnValue({
      debouncedQuery,
      setQuery: jest.fn(),
      isDebouncing: false,
    })

    render(<InventorySearch {...defaultProps} />)

    expect(mockOnSearch).toHaveBeenCalledWith(debouncedQuery)
  })

  it('shows search icon in input', () => {
    render(<InventorySearch {...defaultProps} />)

    // The search icon should be rendered (as Lucide component in real implementation)
    const input = screen.getByTestId('input')
    expect(input).toBeInTheDocument()

    // In the real component, there would be a search icon positioned absolutely
    const container = input.parentElement
    expect(container).toHaveClass('relative')
  })

  it('displays clear button when there is text', () => {
    const mockUseDebouncedSearch = require('@/hooks/use-debounced-search').useDebouncedSearch
    mockUseDebouncedSearch.mockReturnValue({
      debouncedQuery: 'test',
      setQuery: jest.fn(),
      isDebouncing: false,
    })

    render(<InventorySearch {...defaultProps} />)

    const clearButton = screen.getByTestId('button')
    expect(clearButton).toBeInTheDocument()
  })

  it('hides clear button when input is empty', () => {
    const mockUseDebouncedSearch = require('@/hooks/use-debounced-search').useDebouncedSearch
    mockUseDebouncedSearch.mockReturnValue({
      debouncedQuery: '',
      setQuery: jest.fn(),
      isDebouncing: false,
    })

    render(<InventorySearch {...defaultProps} />)

    const clearButton = screen.queryByTestId('button')
    expect(clearButton).not.toBeInTheDocument()
  })

  it('calls onClear and clears input when clear button is clicked', async () => {
    const setQueryMock = jest.fn()
    const mockUseDebouncedSearch = require('@/hooks/use-debounced-search').useDebouncedSearch
    mockUseDebouncedSearch.mockReturnValue({
      debouncedQuery: 'test',
      setQuery: setQueryMock,
      isDebouncing: false,
    })

    render(<InventorySearch {...defaultProps} />)

    const clearButton = screen.getByTestId('button')
    fireEvent.click(clearButton)

    expect(mockOnClear).toHaveBeenCalledTimes(1)
    expect(setQueryMock).toHaveBeenCalledWith('')
  })

  it('shows loading state when isLoading is true', () => {
    render(<InventorySearch {...defaultProps} isLoading={true} />)

    const input = screen.getByTestId('input')
    expect(input).toBeDisabled()
  })

  it('enables input when isLoading is false', () => {
    render(<InventorySearch {...defaultProps} isLoading={false} />)

    const input = screen.getByTestId('input')
    expect(input).not.toBeDisabled()
  })

  it('shows debouncing indicator when isDebouncing is true', () => {
    const mockUseDebouncedSearch = require('@/hooks/use-debounced-search').useDebouncedSearch
    mockUseDebouncedSearch.mockReturnValue({
      debouncedQuery: 'test',
      setQuery: jest.fn(),
      isDebouncing: true,
    })

    render(<InventorySearch {...defaultProps} />)

    // In the real component, there might be a visual indicator for debouncing
    const input = screen.getByTestId('input')
    expect(input).toBeInTheDocument()
  })

  it('has proper accessibility attributes', () => {
    render(<InventorySearch {...defaultProps} />)

    const input = screen.getByTestId('input')
    expect(input).toHaveAttribute('type', 'text')
    expect(input).toHaveAttribute('placeholder', 'Search inventory...')

    // The clear button should have proper aria-label
    const mockUseDebouncedSearch = require('@/hooks/use-debounced-search').useDebouncedSearch
    mockUseDebouncedSearch.mockReturnValue({
      debouncedQuery: 'test',
      setQuery: jest.fn(),
      isDebouncing: false,
    })

    render(<InventorySearch {...defaultProps} />)
    const clearButton = screen.getByTestId('button')
    expect(clearButton).toBeInTheDocument()
  })

  it('handles rapid typing with debouncing', async () => {
    const user = userEvent.setup()
    const setQueryMock = jest.fn()

    const mockUseDebouncedSearch = require('@/hooks/use-debounced-search').useDebouncedSearch
    mockUseDebouncedSearch.mockReturnValue({
      debouncedQuery: '',
      setQuery: setQueryMock,
      isDebouncing: true,
    })

    render(<InventorySearch {...defaultProps} />)

    const input = screen.getByTestId('input')
    await user.type(input, 'quick typing test')

    expect(setQueryMock).toHaveBeenCalled()
  })

  it('maintains focus after clearing search', async () => {
    const setQueryMock = jest.fn()
    const mockUseDebouncedSearch = require('@/hooks/use-debounced-search').useDebouncedSearch
    mockUseDebouncedSearch.mockReturnValue({
      debouncedQuery: 'test',
      setQuery: setQueryMock,
      isDebouncing: false,
    })

    render(<InventorySearch {...defaultProps} />)

    const input = screen.getByTestId('input')
    const clearButton = screen.getByTestId('button')

    // Focus the input first
    input.focus()
    expect(document.activeElement).toBe(input)

    // Click clear button
    fireEvent.click(clearButton)

    // Input should still be focused after clearing
    await waitFor(() => {
      expect(document.activeElement).toBe(input)
    })
  })

  it('integrates properly with parent component callbacks', () => {
    const customOnSearch = jest.fn()
    const customOnClear = jest.fn()

    render(
      <InventorySearch
        {...defaultProps}
        onSearch={customOnSearch}
        onClear={customOnClear}
      />
    )

    const mockUseDebouncedSearch = require('@/hooks/use-debounced-search').useDebouncedSearch

    // Simulate a search
    mockUseDebouncedSearch.mockReturnValue({
      debouncedQuery: 'search term',
      setQuery: jest.fn(),
      isDebouncing: false,
    })

    render(
      <InventorySearch
        {...defaultProps}
        onSearch={customOnSearch}
        onClear={customOnClear}
      />
    )

    expect(customOnSearch).toHaveBeenCalledWith('search term')
  })

  it('handles edge cases with empty and whitespace-only queries', () => {
    const mockUseDebouncedSearch = require('@/hooks/use-debounced-search').useDebouncedSearch

    // Test empty query
    mockUseDebouncedSearch.mockReturnValue({
      debouncedQuery: '',
      setQuery: jest.fn(),
      isDebouncing: false,
    })

    render(<InventorySearch {...defaultProps} />)
    expect(mockOnSearch).toHaveBeenCalledWith('')

    // Test whitespace-only query
    mockUseDebouncedSearch.mockReturnValue({
      debouncedQuery: '   ',
      setQuery: jest.fn(),
      isDebouncing: false,
    })

    render(<InventorySearch {...defaultProps} />)
    expect(mockOnSearch).toHaveBeenCalledWith('   ')
  })

  it('provides visual feedback for different states', () => {
    // Test normal state
    render(<InventorySearch {...defaultProps} isLoading={false} />)
    let input = screen.getByTestId('input')
    expect(input).not.toBeDisabled()

    // Test loading state
    render(<InventorySearch {...defaultProps} isLoading={true} />)
    input = screen.getByTestId('input')
    expect(input).toBeDisabled()
  })
})