# Issue #53 Analysis: Juice Transaction Form

## Overview
Create a transaction form for recording juice purchases from external vendors by cloning and modifying the existing apple purchase form structure, with specific fields for juice quality metrics and processing information.

## Work Streams

### Stream A: Form Component Implementation
**Type:** single-stream
**Agent:** general-purpose
**Files:**
- apps/web/src/components/inventory/JuiceTransactionForm.tsx (new)
- apps/web/src/app/inventory/page.tsx (update)

**Work:**
1. Clone existing purchase form structure (following additives pattern)
2. Modify fields for juice purchases:
   - Juice type selection (apple, pear, grape, mixed, other)
   - Source/vendor selection (reuse existing component)
   - Volume and unit (gallons, liters, barrels)
   - Brix/sugar content measurement
   - pH level measurement
   - Processing date
   - Tank/container assignment (optional)
   - Quality notes
3. Create Zod schema for validation with juice-specific rules
4. Implement form submission handler
5. Connect to transaction type selector

## Implementation Details

### Field Structure
```
JuiceTransactionForm
├── Vendor selector (existing component)
├── Purchase date
├── Juice lines (dynamic)
│   ├── Juice type dropdown
│   ├── Description/variety details
│   ├── Volume input
│   ├── Unit selector (gallons, liters, barrels)
│   ├── Brix measurement input (0-30)
│   ├── pH level input (2.8-4.2)
│   ├── Processing date picker
│   ├── Tank assignment (optional)
│   └── Quality notes textarea
├── Add line button
├── General notes field
└── Submit button
```

### Validation Rules
- Brix: 0-30 (typical range for juice)
- pH: 2.8-4.2 (safe range for cider juice)
- Volume: positive numbers only
- Processing date: cannot be future

### Integration Points
- Connects from TransactionTypeSelector (issue #51)
- Uses existing vendor management system
- Will integrate with unified API (issue #55)

## Dependencies
- Issue #51 (Transaction Type Selector) - already completed
- Issue #52 (Additives form) - provides pattern to follow
- Existing vendor selector component
- Existing form validation patterns

## Coordination Points
- Single stream task - no coordination needed
- Will use placeholder API until issue #55 is complete
- Should follow same pattern as additives form (issue #52)

## Risk Mitigation
- Clone working additives form to ensure consistency
- Use same validation patterns as other forms
- Include proper quality metric validation for juice safety