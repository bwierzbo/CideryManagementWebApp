# Fruit Load Entry Components - Task #25

This directory contains the mobile-first React components for fruit load entry during pressing sessions, implementing the complete workflow for Task #25 of the ApplePress epic.

## Components Overview

### 1. PressRunManager (`PressRunManager.tsx`)
Main orchestration component that manages the entire press run workflow.

**Key Features:**
- Lists existing press runs with status indicators
- Handles vendor selection for new press runs
- Integrates with tRPC API endpoints for press run operations
- Manages state transitions between list, wizard, and form views
- Provides optimistic UI updates with error handling

**Usage:**
```tsx
import { PressRunManager } from '@/components/pressing'

<PressRunManager vendorId="optional-vendor-id" />
```

### 2. PressRunWizard (`PressRunWizard.tsx`)
Step-by-step wizard for guiding operators through press run setup and completion.

**Key Features:**
- Three-step workflow: Setup → Loads → Completion
- Progress indicator with mobile-optimized step navigation
- Load management with summary statistics
- Weight tracking in both kg and lbs
- Mobile-first responsive design

**Steps:**
1. **Setup**: Configure press run details
2. **Loads**: Add fruit loads with integrated form
3. **Completion**: Review and finalize press run

### 3. FruitLoadFormWithTRPC (`FruitLoadFormWithTRPC.tsx`)
Production-ready form component with full tRPC integration.

**Key Features:**
- Real-time purchase line inventory validation
- Weight input with lbs/kg unit conversion (lbs default)
- Apple variety selection from available purchase lines
- Quality tracking (Brix, pH, condition assessment)
- Touch-optimized mobile interface (44px minimum tap targets)
- Comprehensive error handling and loading states

**Form Fields:**
- Purchase line selection with search/filter
- Weight input with unit toggle
- Quality measurements (Brix, pH, condition, defect %)
- Notes for operational observations

### 4. FruitLoadForm (`FruitLoadForm.tsx`)
Standalone form component with mock data for development/testing.

## Mobile Optimizations

All components follow mobile-first design principles:

- **Touch Targets**: Minimum 44px tap targets for accessibility
- **Large Buttons**: 12px height (h-12) for main action buttons
- **Touch Classes**: `touch-manipulation` for better touch response
- **Active States**: Clear visual feedback for button presses
- **Grid Layouts**: Responsive grids that stack on mobile
- **Large Text**: Readable font sizes for mobile screens
- **Spacing**: Adequate spacing between interactive elements

## API Integration

Components integrate with the following tRPC endpoints:

- `pressRun.list` - List press runs with filtering
- `pressRun.create` - Create new press run
- `pressRun.addLoad` - Add fruit load to press run
- `pressRun.finish` - Complete press run
- `purchaseLine.available` - Get available purchase lines
- `purchaseLine.validateAvailability` - Real-time inventory validation
- `appleVariety.list` - List apple varieties
- `vendor.list` - List vendors

## Data Flow

1. **Press Run Creation**:
   ```
   PressRunManager → Vendor Selection → API Call → PressRunWizard
   ```

2. **Load Addition**:
   ```
   PressRunWizard → FruitLoadFormWithTRPC → API Validation → Optimistic Update → API Call
   ```

3. **Press Run Completion**:
   ```
   PressRunWizard → Summary Review → API Call → Redirect to List
   ```

## State Management

- **Optimistic Updates**: Load additions update UI immediately
- **Error Recovery**: Failed operations revert optimistic changes
- **Loading States**: Clear indicators during API operations
- **Real-time Validation**: Inventory checks prevent over-allocation

## Error Handling

- **Network Errors**: User-friendly messages with retry options
- **Validation Errors**: Form-level and field-level error display
- **Inventory Issues**: Real-time warnings for insufficient stock
- **API Failures**: Graceful degradation with fallback states

## Weight Unit Conversion

Built-in conversion system with real-time display:
- **Pounds to Kilograms**: `weight * 0.453592`
- **Kilograms to Pounds**: `weight * 2.20462`
- **Display**: Shows both original and converted values
- **Storage**: Always stores in kg for database consistency

## Form Validation

Using Zod schema validation:
- **Weight**: 0.1 - 10,000 range with decimal precision
- **Brix**: 0-30° range for sugar content
- **pH**: 2-5 range for acidity
- **Defect**: 0-100% percentage validation
- **UUIDs**: Proper format validation for IDs

## Testing Integration

Components are designed for comprehensive testing:
- **Unit Tests**: Form validation and conversion logic
- **Integration Tests**: API interaction patterns
- **E2E Tests**: Complete workflow testing
- **Accessibility**: Screen reader and keyboard navigation support

## Performance Considerations

- **Lazy Loading**: Components load data on demand
- **Debounced Search**: Efficient search filtering
- **Optimistic Updates**: Immediate UI feedback
- **Error Boundaries**: Graceful error handling
- **Memory Cleanup**: Proper component unmounting

## Accessibility Features

- **ARIA Labels**: Proper labeling for screen readers
- **Keyboard Navigation**: Full keyboard support
- **Focus Management**: Logical tab order
- **Color Contrast**: WCAG-compliant color schemes
- **Touch Targets**: Minimum 44px for accessibility guidelines

## Future Enhancements for Task #27 (Offline Capability)

The components are structured to support offline functionality:
- **Local State**: Component state can be persisted
- **Optimistic Updates**: Already implemented for offline sync
- **Error Handling**: Structured for offline/online transitions
- **Data Structure**: Compatible with offline storage patterns

## Dependencies

- React Hook Form with Zod validation
- Tailwind CSS for styling
- Lucide React for icons
- tRPC for API integration
- shadcn/ui component library