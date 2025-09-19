# Issue #54 Analysis: Packaging Transaction Form

## Overview
Create a transaction form for recording packaging material purchases (bottles, cans, labels, caps, corks) by cloning and modifying the existing form structure, with specific fields for packaging specifications and logistics.

## Work Streams

### Stream A: Form Component Implementation
**Type:** single-stream
**Agent:** general-purpose
**Files:**
- apps/web/src/components/inventory/PackagingTransactionForm.tsx (new)
- apps/web/src/app/inventory/page.tsx (update)

**Work:**
1. Clone existing form structure (following additives/juice pattern)
2. Modify fields for packaging purchases:
   - Package type selection (bottles, cans, kegs, cases, caps, labels, corks)
   - Size/specification details (750ml, 12oz, 500ml, etc.)
   - Quantity per unit (e.g., cases of 12, boxes of 1000)
   - SKU/product code tracking
   - Lead time information
   - Minimum order quantity
   - Material specifications (glass color, label material, etc.)
3. Create Zod schema for validation with packaging-specific rules
4. Implement form submission handler
5. Connect to transaction type selector

## Implementation Details

### Field Structure
```
PackagingTransactionForm
├── Vendor selector (existing component)
├── Purchase date
├── Packaging lines (dynamic)
│   ├── Package type dropdown
│   ├── Size/specification input
│   ├── Product description
│   ├── Quantity input
│   ├── Unit type (cases, boxes, individual, pallets)
│   ├── Quantity per unit input
│   ├── SKU/product code
│   ├── Lead time (days)
│   ├── Minimum order quantity
│   └── Material specifications/notes
├── Add line button
├── General notes field
└── Submit button
```

### Package Types
- Bottles (glass/plastic)
- Cans (aluminum)
- Kegs (stainless steel)
- Cases/carriers
- Caps/closures
- Labels
- Corks
- Other packaging

### Integration Points
- Connects from TransactionTypeSelector (issue #51)
- Uses existing vendor management system
- Will integrate with unified API (issue #55)

## Dependencies
- Issue #51 (Transaction Type Selector) - already completed
- Issues #52, #53 (Additives/Juice forms) - provide pattern to follow
- Existing vendor selector component
- Existing form validation patterns

## Coordination Points
- Single stream task - no coordination needed
- Will use placeholder API until issue #55 is complete
- Should follow same pattern as additives and juice forms

## Risk Mitigation
- Clone working forms to ensure consistency
- Use same validation patterns as other forms
- Include proper packaging-specific validation