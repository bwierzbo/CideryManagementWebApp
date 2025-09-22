# Issue #52 Analysis: Additives Transaction Form

## Overview
Create a transaction form for recording additive purchases (enzymes, nutrients, clarifiers, preservatives) by cloning and modifying the existing apple purchase form structure.

## Work Streams

### Stream A: Form Component Implementation
**Type:** single-stream
**Agent:** general-purpose
**Files:**
- apps/web/src/components/inventory/AdditivesTransactionForm.tsx (new)
- apps/web/src/app/inventory/page.tsx (update)

**Work:**
1. Clone PurchaseFormComponent from existing code
2. Modify fields for additives:
   - Additive type selection (enzyme, nutrient, clarifier, preservative)
   - Brand/manufacturer field
   - Quantity and unit (g, kg, oz, lb)
   - Lot/batch number
   - Expiration date
   - Storage requirements notes
3. Create Zod schema for validation
4. Reuse vendor selector component
5. Implement form submission handler
6. Connect to transaction type selector

## Implementation Details

### Field Structure
```
AdditivesTransactionForm
├── Vendor selector (existing component)
├── Purchase date
├── Additive lines (dynamic)
│   ├── Additive type dropdown
│   ├── Brand/manufacturer input
│   ├── Quantity input
│   ├── Unit selector (g, kg, oz, lb)
│   ├── Lot number input
│   ├── Expiration date picker
│   └── Storage notes textarea
├── Add line button
├── Notes field
└── Submit button
```

### Integration Points
- Connects from TransactionTypeSelector (issue #51)
- Uses existing vendor management system
- Will integrate with unified API (issue #55)

## Dependencies
- Issue #51 (Transaction Type Selector) - already completed
- Existing vendor selector component
- Existing form patterns

## Coordination Points
- Single stream task - no coordination needed
- Will use placeholder API until issue #55 is complete

## Risk Mitigation
- Clone existing working form to ensure consistency
- Use same validation patterns
- Maintain UI/UX consistency with existing forms