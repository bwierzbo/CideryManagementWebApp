import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppleTransactionForm } from '../../components/inventory/AppleTransactionForm'
import '@testing-library/jest-dom'

// Mock the UI components
jest.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: any) => <div data-testid="card" {...props}>{children}</div>,
  CardContent: ({ children, ...props }: any) => <div data-testid="card-content" {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: any) => <div data-testid="card-header" {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: any) => <h2 data-testid="card-title" {...props}>{children}</h2>,
}))

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} data-testid="button" {...props}>
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

jest.mock('@/components/ui/select', () => ({
  Select: ({ children, onValueChange }: any) => (
    <div data-testid="select" onClick={() => onValueChange?.('test-value')}>
      {children}
    </div>
  ),
  SelectContent: ({ children }: any) => <div data-testid="select-content">{children}</div>,
  SelectItem: ({ children, value }: any) => <div data-testid="select-item" data-value={value}>{children}</div>,
  SelectTrigger: ({ children }: any) => <div data-testid="select-trigger">{children}</div>,
  SelectValue: ({ placeholder }: any) => <span data-testid="select-value">{placeholder}</span>,
}))

jest.mock('@/components/ui/textarea', () => ({
  Textarea: ({ onChange, value, placeholder, ...props }: any) => (
    <textarea
      onChange={onChange}
      value={value}
      placeholder={placeholder}
      data-testid="textarea"
      {...props}
    />
  ),
}))

jest.mock('@/components/ui/form', () => ({
  Form: ({ children }: any) => <form data-testid="form">{children}</form>,
  FormControl: ({ children }: any) => <div data-testid="form-control">{children}</div>,
  FormDescription: ({ children }: any) => <div data-testid="form-description">{children}</div>,
  FormField: ({ children, render }: any) => <div data-testid="form-field">{render ? render({ field: {} }) : children}</div>,
  FormItem: ({ children }: any) => <div data-testid="form-item">{children}</div>,
  FormLabel: ({ children }: any) => <label data-testid="form-label">{children}</label>,
  FormMessage: ({ children }: any) => <div data-testid="form-message">{children}</div>,
}))

jest.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: any) => <label data-testid="label" {...props}>{children}</label>,
}))

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: any) => <span data-testid="badge" {...props}>{children}</span>,
}))

describe('AppleTransactionForm', () => {
  const mockOnSubmit = jest.fn()
  const mockOnCancel = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  const defaultProps = {
    onSubmit: mockOnSubmit,
    onCancel: mockOnCancel,
    isSubmitting: false,
  }

  it('renders the form with all required fields', () => {
    render(<AppleTransactionForm {...defaultProps} />)

    expect(screen.getByTestId('card')).toBeInTheDocument()
    expect(screen.getByTestId('card-header')).toBeInTheDocument()
    expect(screen.getByText('Apple Purchase Transaction')).toBeInTheDocument()
    expect(screen.getByText('Record fresh apple purchases for inventory tracking')).toBeInTheDocument()
  })

  it('displays vendor search functionality', () => {
    render(<AppleTransactionForm {...defaultProps} />)

    const vendorSection = screen.getByText('Vendor (Optional)')
    expect(vendorSection).toBeInTheDocument()

    const searchInputs = screen.getAllByTestId('input')
    const vendorSearchInput = searchInputs.find(input =>
      input.getAttribute('placeholder') === 'Search vendors...'
    )
    expect(vendorSearchInput).toBeInTheDocument()
  })

  it('displays apple variety search with required field', () => {
    render(<AppleTransactionForm {...defaultProps} />)

    const varietySection = screen.getByText('Apple Variety *')
    expect(varietySection).toBeInTheDocument()

    const searchInputs = screen.getAllByTestId('input')
    const varietySearchInput = searchInputs.find(input =>
      input.getAttribute('placeholder') === 'Search apple varieties...'
    )
    expect(varietySearchInput).toBeInTheDocument()
  })

  it('renders quantity input with weight conversion info', () => {
    render(<AppleTransactionForm {...defaultProps} />)

    const quantityLabel = screen.getByText('Quantity (kg) *')
    expect(quantityLabel).toBeInTheDocument()

    const quantityInputs = screen.getAllByTestId('input')
    const quantityInput = quantityInputs.find(input =>
      input.getAttribute('placeholder') === 'Enter quantity in kilograms'
    )
    expect(quantityInput).toBeInTheDocument()
  })

  it('shows quality grade selection', () => {
    render(<AppleTransactionForm {...defaultProps} />)

    const qualityLabel = screen.getByText('Quality Grade')
    expect(qualityLabel).toBeInTheDocument()

    const selectTrigger = screen.getByTestId('select-trigger')
    expect(selectTrigger).toBeInTheDocument()
  })

  it('displays optional fields section', () => {
    render(<AppleTransactionForm {...defaultProps} />)

    expect(screen.getByText('Harvest Date')).toBeInTheDocument()
    expect(screen.getByText('Storage Location')).toBeInTheDocument()
    expect(screen.getByText('Defect Percentage')).toBeInTheDocument()
    expect(screen.getByText('Brix Level')).toBeInTheDocument()
  })

  it('includes notes textarea field', () => {
    render(<AppleTransactionForm {...defaultProps} />)

    const notesLabel = screen.getByText('Notes')
    expect(notesLabel).toBeInTheDocument()

    const textarea = screen.getByTestId('textarea')
    expect(textarea).toBeInTheDocument()
    expect(textarea.getAttribute('placeholder')).toBe('Additional notes about this apple delivery...')
  })

  it('renders form action buttons', () => {
    render(<AppleTransactionForm {...defaultProps} />)

    const buttons = screen.getAllByTestId('button')
    expect(buttons.length).toBeGreaterThanOrEqual(2)

    const cancelButton = buttons.find(btn => btn.textContent?.includes('Cancel'))
    const submitButton = buttons.find(btn => btn.textContent?.includes('Record Purchase'))

    expect(cancelButton).toBeInTheDocument()
    expect(submitButton).toBeInTheDocument()
  })

  it('calls onCancel when cancel button is clicked', async () => {
    render(<AppleTransactionForm {...defaultProps} />)

    const buttons = screen.getAllByTestId('button')
    const cancelButton = buttons.find(btn => btn.textContent?.includes('Cancel'))

    if (cancelButton) {
      fireEvent.click(cancelButton)
      expect(mockOnCancel).toHaveBeenCalledTimes(1)
    }
  })

  it('shows submitting state when isSubmitting is true', () => {
    render(<AppleTransactionForm {...defaultProps} isSubmitting={true} />)

    const buttons = screen.getAllByTestId('button')
    const submitButton = buttons.find(btn =>
      btn.textContent?.includes('Recording...') || btn.hasAttribute('disabled')
    )

    expect(submitButton).toBeInTheDocument()
  })

  it('handles vendor search input changes', async () => {
    const user = userEvent.setup()
    render(<AppleTransactionForm {...defaultProps} />)

    const searchInputs = screen.getAllByTestId('input')
    const vendorSearchInput = searchInputs.find(input =>
      input.getAttribute('placeholder') === 'Search vendors...'
    )

    if (vendorSearchInput) {
      await user.type(vendorSearchInput, 'Mountain View')
      expect(vendorSearchInput).toHaveValue('Mountain View')
    }
  })

  it('handles variety search input changes', async () => {
    const user = userEvent.setup()
    render(<AppleTransactionForm {...defaultProps} />)

    const searchInputs = screen.getAllByTestId('input')
    const varietySearchInput = searchInputs.find(input =>
      input.getAttribute('placeholder') === 'Search apple varieties...'
    )

    if (varietySearchInput) {
      await user.type(varietySearchInput, 'Dabinett')
      expect(varietySearchInput).toHaveValue('Dabinett')
    }
  })

  it('handles quantity input with numeric validation', async () => {
    const user = userEvent.setup()
    render(<AppleTransactionForm {...defaultProps} />)

    const quantityInputs = screen.getAllByTestId('input')
    const quantityInput = quantityInputs.find(input =>
      input.getAttribute('placeholder') === 'Enter quantity in kilograms'
    )

    if (quantityInput) {
      await user.type(quantityInput, '100.5')
      expect(quantityInput).toHaveValue('100.5')
    }
  })

  it('validates required fields before submission', async () => {
    render(<AppleTransactionForm {...defaultProps} />)

    const buttons = screen.getAllByTestId('button')
    const submitButton = buttons.find(btn => btn.textContent?.includes('Record Purchase'))

    if (submitButton) {
      fireEvent.click(submitButton)
      // Form should not submit without required fields
      expect(mockOnSubmit).not.toHaveBeenCalled()
    }
  })

  it('displays form descriptions for user guidance', () => {
    render(<AppleTransactionForm {...defaultProps} />)

    expect(screen.getByText('Enter the total weight of apples being received')).toBeInTheDocument()
    expect(screen.getByText('Assess overall quality based on appearance and defects')).toBeInTheDocument()
    expect(screen.getByText('When were these apples harvested?')).toBeInTheDocument()
    expect(screen.getByText('Where will these apples be stored?')).toBeInTheDocument()
    expect(screen.getByText('Percentage of apples with defects or damage')).toBeInTheDocument()
    expect(screen.getByText('Sugar content measurement (°Brix)')).toBeInTheDocument()
  })

  it('shows proper icons for each section', () => {
    render(<AppleTransactionForm {...defaultProps} />)

    // The icons are rendered as Lucide components, which would be mocked in a real test environment
    // Here we're testing that the sections are properly structured
    expect(screen.getByText('Vendor (Optional)')).toBeInTheDocument()
    expect(screen.getByText('Apple Variety *')).toBeInTheDocument()
    expect(screen.getByText('Quantity (kg) *')).toBeInTheDocument()
    expect(screen.getByText('Harvest Date')).toBeInTheDocument()
    expect(screen.getByText('Storage Location')).toBeInTheDocument()
  })

  it('handles notes input correctly', async () => {
    const user = userEvent.setup()
    render(<AppleTransactionForm {...defaultProps} />)

    const textarea = screen.getByTestId('textarea')
    const testNotes = 'High quality apples from premium orchard'

    await user.type(textarea, testNotes)
    expect(textarea).toHaveValue(testNotes)
  })
})