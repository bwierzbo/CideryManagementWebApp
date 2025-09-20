import { render, screen } from '@testing-library/react'
import { MaterialTypeIndicator } from '@/components/inventory/MaterialTypeIndicator'
import '@testing-library/jest-dom'

// Mock the UI components
jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className, variant, ...props }: any) => (
    <span
      data-testid="badge"
      data-variant={variant}
      className={className}
      {...props}
    >
      {children}
    </span>
  ),
}))

describe('MaterialTypeIndicator', () => {
  it('renders apple material type correctly', () => {
    render(<MaterialTypeIndicator type="apple" />)

    const badge = screen.getByTestId('badge')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent('🍎 Fresh Fruit')
    expect(badge).toHaveClass('bg-red-100', 'text-red-800', 'border-red-200')
  })

  it('renders additive material type correctly', () => {
    render(<MaterialTypeIndicator type="additive" />)

    const badge = screen.getByTestId('badge')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent('🧪 Additives')
    expect(badge).toHaveClass('bg-purple-100', 'text-purple-800', 'border-purple-200')
  })

  it('renders juice material type correctly', () => {
    render(<MaterialTypeIndicator type="juice" />)

    const badge = screen.getByTestId('badge')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent('🧃 Juice')
    expect(badge).toHaveClass('bg-blue-100', 'text-blue-800', 'border-blue-200')
  })

  it('renders packaging material type correctly', () => {
    render(<MaterialTypeIndicator type="packaging" />)

    const badge = screen.getByTestId('badge')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent('📦 Packaging')
    expect(badge).toHaveClass('bg-amber-100', 'text-amber-800', 'border-amber-200')
  })

  it('handles unknown material type gracefully', () => {
    // @ts-ignore - Testing invalid type
    render(<MaterialTypeIndicator type="unknown" />)

    const badge = screen.getByTestId('badge')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent('❓ Unknown')
    expect(badge).toHaveClass('bg-gray-100', 'text-gray-800', 'border-gray-200')
  })

  it('applies custom className when provided', () => {
    const customClass = 'custom-indicator-class'
    render(<MaterialTypeIndicator type="apple" className={customClass} />)

    const badge = screen.getByTestId('badge')
    expect(badge).toHaveClass(customClass)
  })

  it('maintains consistent badge structure across all types', () => {
    const types = ['apple', 'additive', 'juice', 'packaging'] as const

    types.forEach(type => {
      const { rerender } = render(<MaterialTypeIndicator type={type} />)

      const badge = screen.getByTestId('badge')
      expect(badge).toBeInTheDocument()
      expect(badge).toHaveAttribute('data-variant', 'outline')

      // Each badge should have emoji + text content
      expect(badge.textContent).toMatch(/^[📦🍎🧪🧃].+/)

      rerender(<div />)
    })
  })

  it('provides proper accessibility with semantic content', () => {
    render(<MaterialTypeIndicator type="apple" />)

    const badge = screen.getByTestId('badge')
    expect(badge).toHaveAttribute('role', 'status')
    expect(badge).toHaveAttribute('aria-label', 'Material type: Fresh Fruit')
  })

  it('displays correct icons for each material type', () => {
    const expectedIcons = {
      apple: '🍎',
      additive: '🧪',
      juice: '🧃',
      packaging: '📦',
    }

    Object.entries(expectedIcons).forEach(([type, icon]) => {
      const { rerender } = render(<MaterialTypeIndicator type={type as any} />)

      const badge = screen.getByTestId('badge')
      expect(badge.textContent).toStartWith(icon)

      rerender(<div />)
    })
  })

  it('has consistent color schemes that match design system', () => {
    const colorSchemes = {
      apple: ['bg-red-100', 'text-red-800', 'border-red-200'],
      additive: ['bg-purple-100', 'text-purple-800', 'border-purple-200'],
      juice: ['bg-blue-100', 'text-blue-800', 'border-blue-200'],
      packaging: ['bg-amber-100', 'text-amber-800', 'border-amber-200'],
    }

    Object.entries(colorSchemes).forEach(([type, colors]) => {
      const { rerender } = render(<MaterialTypeIndicator type={type as any} />)

      const badge = screen.getByTestId('badge')
      colors.forEach(colorClass => {
        expect(badge).toHaveClass(colorClass)
      })

      rerender(<div />)
    })
  })

  it('works with size variants', () => {
    render(<MaterialTypeIndicator type="apple" size="sm" />)

    const badge = screen.getByTestId('badge')
    expect(badge).toHaveClass('text-xs')
  })

  it('supports hover effects', () => {
    render(<MaterialTypeIndicator type="apple" />)

    const badge = screen.getByTestId('badge')
    expect(badge).toHaveClass('transition-colors')
  })

  it('maintains readability with proper contrast', () => {
    // Test that each color combination provides good contrast
    const types = ['apple', 'additive', 'juice', 'packaging'] as const

    types.forEach(type => {
      const { rerender } = render(<MaterialTypeIndicator type={type} />)

      const badge = screen.getByTestId('badge')

      // Background should be light (100 series)
      expect(badge.className).toMatch(/-100/)

      // Text should be dark (800 series)
      expect(badge.className).toMatch(/-800/)

      rerender(<div />)
    })
  })

  it('integrates well with other UI components', () => {
    // Test in a list context
    render(
      <div>
        <MaterialTypeIndicator type="apple" />
        <MaterialTypeIndicator type="additive" />
        <MaterialTypeIndicator type="juice" />
      </div>
    )

    const badges = screen.getAllByTestId('badge')
    expect(badges).toHaveLength(3)

    // Each should maintain its unique styling
    expect(badges[0]).toHaveTextContent('🍎 Fresh Fruit')
    expect(badges[1]).toHaveTextContent('🧪 Additives')
    expect(badges[2]).toHaveTextContent('🧃 Juice')
  })

  it('handles responsive design considerations', () => {
    render(<MaterialTypeIndicator type="apple" />)

    const badge = screen.getByTestId('badge')

    // Should have responsive text sizing
    expect(badge).toHaveClass('text-xs')

    // Should work in flex layouts
    expect(badge.className).toMatch(/inline/)
  })

  it('provides tooltip information on hover', () => {
    render(<MaterialTypeIndicator type="apple" showTooltip />)

    const badge = screen.getByTestId('badge')
    expect(badge).toHaveAttribute('title', 'Fresh apple varieties for pressing')
  })

  it('supports different display modes', () => {
    // Icon only mode
    render(<MaterialTypeIndicator type="apple" iconOnly />)
    let badge = screen.getByTestId('badge')
    expect(badge).toHaveTextContent('🍎')
    expect(badge.textContent).not.toContain('Fresh Fruit')

    // Text only mode
    const { rerender } = render(<MaterialTypeIndicator type="apple" textOnly />)
    badge = screen.getByTestId('badge')
    expect(badge).toHaveTextContent('Fresh Fruit')
    expect(badge.textContent).not.toContain('🍎')
  })

  it('maintains consistent spacing and alignment', () => {
    render(<MaterialTypeIndicator type="apple" />)

    const badge = screen.getByTestId('badge')

    // Should have proper padding
    expect(badge).toHaveClass('px-2', 'py-1')

    // Should align properly with other content
    expect(badge).toHaveClass('inline-flex', 'items-center')
  })

  it('works in different container contexts', () => {
    // Test in table cell
    render(
      <table>
        <tbody>
          <tr>
            <td>
              <MaterialTypeIndicator type="apple" />
            </td>
          </tr>
        </tbody>
      </table>
    )

    const badge = screen.getByTestId('badge')
    expect(badge).toBeInTheDocument()

    // Test in card context
    const { rerender } = render(
      <div className="card">
        <MaterialTypeIndicator type="juice" />
      </div>
    )

    const juiceBadge = screen.getByTestId('badge')
    expect(juiceBadge).toHaveTextContent('🧃 Juice')
  })
})