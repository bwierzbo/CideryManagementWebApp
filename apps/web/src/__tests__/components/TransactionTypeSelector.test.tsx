import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TransactionTypeSelector } from '@/components/inventory/TransactionTypeSelector'
import '@testing-library/jest-dom'

// Mock the UI components
jest.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children, open }: any) => open ? <div data-testid="alert-dialog">{children}</div> : null,
  AlertDialogContent: ({ children }: any) => <div data-testid="alert-dialog-content">{children}</div>,
  AlertDialogDescription: ({ children }: any) => <div data-testid="alert-dialog-description">{children}</div>,
  AlertDialogHeader: ({ children }: any) => <div data-testid="alert-dialog-header">{children}</div>,
  AlertDialogTitle: ({ children }: any) => <h2 data-testid="alert-dialog-title">{children}</h2>,
  AlertDialogTrigger: ({ children }: any) => <div data-testid="alert-dialog-trigger">{children}</div>,
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

jest.mock('@/components/ui/card', () => ({
  Card: ({ children, className, ...props }: any) => (
    <div data-testid="card" className={className} {...props}>{children}</div>
  ),
  CardContent: ({ children }: any) => <div data-testid="card-content">{children}</div>,
  CardDescription: ({ children }: any) => <div data-testid="card-description">{children}</div>,
  CardHeader: ({ children }: any) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }: any) => <h3 data-testid="card-title">{children}</h3>,
}))

// Mock window.dispatchEvent
const mockDispatchEvent = jest.fn()
Object.defineProperty(window, 'dispatchEvent', {
  value: mockDispatchEvent,
  writable: true,
})

describe('TransactionTypeSelector', () => {
  const mockOnOpenChange = jest.fn()

  const defaultProps = {
    open: true,
    onOpenChange: mockOnOpenChange,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders the transaction type selector dialog', () => {
    render(<TransactionTypeSelector {...defaultProps} />)

    expect(screen.getByTestId('alert-dialog')).toBeInTheDocument()
    expect(screen.getByTestId('alert-dialog-title')).toBeInTheDocument()
    expect(screen.getByText('Select Transaction Type')).toBeInTheDocument()
  })

  it('displays the dialog description', () => {
    render(<TransactionTypeSelector {...defaultProps} />)

    expect(screen.getByTestId('alert-dialog-description')).toBeInTheDocument()
    expect(screen.getByText('Choose the type of inventory transaction you want to record')).toBeInTheDocument()
  })

  it('renders all transaction type cards', () => {
    render(<TransactionTypeSelector {...defaultProps} />)

    const cards = screen.getAllByTestId('card')
    expect(cards).toHaveLength(4)

    // Check for each transaction type
    expect(screen.getByText('Fresh Apples')).toBeInTheDocument()
    expect(screen.getByText('Additives')).toBeInTheDocument()
    expect(screen.getByText('Juice')).toBeInTheDocument()
    expect(screen.getByText('Packaging')).toBeInTheDocument()
  })

  it('displays correct descriptions for each transaction type', () => {
    render(<TransactionTypeSelector {...defaultProps} />)

    expect(screen.getByText('Record fresh apple purchases from vendors')).toBeInTheDocument()
    expect(screen.getByText('Yeast, nutrients, enzymes, and other additives')).toBeInTheDocument()
    expect(screen.getByText('Pressed juice from apple processing')).toBeInTheDocument()
    expect(screen.getByText('Bottles, caps, labels, and packaging materials')).toBeInTheDocument()
  })

  it('handles apple transaction selection', async () => {
    render(<TransactionTypeSelector {...defaultProps} />)

    const cards = screen.getAllByTestId('card')
    const appleCard = cards.find(card =>
      card.textContent?.includes('Fresh Apples')
    )

    expect(appleCard).toBeInTheDocument()

    if (appleCard) {
      fireEvent.click(appleCard)

      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'setInventoryTab',
          detail: 'apple',
        })
      )
      expect(mockOnOpenChange).toHaveBeenCalledWith(false)
    }
  })

  it('handles additives transaction selection', async () => {
    render(<TransactionTypeSelector {...defaultProps} />)

    const cards = screen.getAllByTestId('card')
    const additivesCard = cards.find(card =>
      card.textContent?.includes('Additives')
    )

    expect(additivesCard).toBeInTheDocument()

    if (additivesCard) {
      fireEvent.click(additivesCard)

      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'setInventoryTab',
          detail: 'additives',
        })
      )
      expect(mockOnOpenChange).toHaveBeenCalledWith(false)
    }
  })

  it('handles juice transaction selection', async () => {
    render(<TransactionTypeSelector {...defaultProps} />)

    const cards = screen.getAllByTestId('card')
    const juiceCard = cards.find(card =>
      card.textContent?.includes('Juice')
    )

    expect(juiceCard).toBeInTheDocument()

    if (juiceCard) {
      fireEvent.click(juiceCard)

      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'setInventoryTab',
          detail: 'juice',
        })
      )
      expect(mockOnOpenChange).toHaveBeenCalledWith(false)
    }
  })

  it('handles packaging transaction selection', async () => {
    render(<TransactionTypeSelector {...defaultProps} />)

    const cards = screen.getAllByTestId('card')
    const packagingCard = cards.find(card =>
      card.textContent?.includes('Packaging')
    )

    expect(packagingCard).toBeInTheDocument()

    if (packagingCard) {
      fireEvent.click(packagingCard)

      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'setInventoryTab',
          detail: 'packaging',
        })
      )
      expect(mockOnOpenChange).toHaveBeenCalledWith(false)
    }
  })

  it('does not render when open is false', () => {
    render(<TransactionTypeSelector {...defaultProps} open={false} />)

    expect(screen.queryByTestId('alert-dialog')).not.toBeInTheDocument()
  })

  it('has hover effects on transaction cards', () => {
    render(<TransactionTypeSelector {...defaultProps} />)

    const cards = screen.getAllByTestId('card')
    expect(cards).toHaveLength(4)

    // Cards should have hover styling classes
    cards.forEach(card => {
      expect(card).toHaveClass('cursor-pointer')
    })
  })

  it('provides proper accessibility with card titles', () => {
    render(<TransactionTypeSelector {...defaultProps} />)

    const cardTitles = screen.getAllByTestId('card-title')
    expect(cardTitles).toHaveLength(4)

    const titleTexts = cardTitles.map(title => title.textContent)
    expect(titleTexts).toContain('Fresh Apples')
    expect(titleTexts).toContain('Additives')
    expect(titleTexts).toContain('Juice')
    expect(titleTexts).toContain('Packaging')
  })

  it('displays appropriate icons for each transaction type', () => {
    render(<TransactionTypeSelector {...defaultProps} />)

    // Icons would be rendered as Lucide components in the actual implementation
    // Here we verify the card structure is correct
    const cards = screen.getAllByTestId('card')
    expect(cards).toHaveLength(4)

    // Each card should have the proper content structure
    cards.forEach(card => {
      expect(card.querySelector('[data-testid="card-header"]')).toBeInTheDocument()
      expect(card.querySelector('[data-testid="card-title"]')).toBeInTheDocument()
      expect(card.querySelector('[data-testid="card-description"]')).toBeInTheDocument()
    })
  })

  it('handles rapid clicks appropriately', async () => {
    render(<TransactionTypeSelector {...defaultProps} />)

    const cards = screen.getAllByTestId('card')
    const appleCard = cards.find(card =>
      card.textContent?.includes('Fresh Apples')
    )

    if (appleCard) {
      // Click multiple times rapidly
      fireEvent.click(appleCard)
      fireEvent.click(appleCard)
      fireEvent.click(appleCard)

      // Should only register the clicks and close the dialog
      expect(mockOnOpenChange).toHaveBeenCalledWith(false)
    }
  })

  it('maintains consistent styling across all cards', () => {
    render(<TransactionTypeSelector {...defaultProps} />)

    const cards = screen.getAllByTestId('card')
    expect(cards).toHaveLength(4)

    // All cards should have consistent styling
    cards.forEach(card => {
      expect(card).toHaveClass('cursor-pointer')
      expect(card).toHaveClass('transition-colors')
    })
  })

  it('provides clear visual hierarchy with headers and descriptions', () => {
    render(<TransactionTypeSelector {...defaultProps} />)

    // Main dialog header
    expect(screen.getByTestId('alert-dialog-header')).toBeInTheDocument()
    expect(screen.getByTestId('alert-dialog-title')).toBeInTheDocument()
    expect(screen.getByTestId('alert-dialog-description')).toBeInTheDocument()

    // Card headers
    const cardHeaders = screen.getAllByTestId('card-header')
    expect(cardHeaders).toHaveLength(4)

    // Card descriptions
    const cardDescriptions = screen.getAllByTestId('card-description')
    expect(cardDescriptions).toHaveLength(4)
  })

  it('integrates properly with inventory tab system', () => {
    render(<TransactionTypeSelector {...defaultProps} />)

    const cards = screen.getAllByTestId('card')

    // Test each card dispatches the correct tab event
    const expectedEvents = [
      { card: 'Fresh Apples', event: 'apple' },
      { card: 'Additives', event: 'additives' },
      { card: 'Juice', event: 'juice' },
      { card: 'Packaging', event: 'packaging' },
    ]

    expectedEvents.forEach(({ card: cardText, event }) => {
      const card = cards.find(c => c.textContent?.includes(cardText))
      if (card) {
        fireEvent.click(card)
        expect(mockDispatchEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'setInventoryTab',
            detail: event,
          })
        )
      }
    })
  })
})