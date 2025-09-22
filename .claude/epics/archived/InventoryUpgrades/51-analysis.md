# Issue #51 Analysis: Transaction Type Selector UI

## Overview
Create a modal component with 4 transaction type buttons that replaces the current "New Purchase" functionality with a more versatile "Record Transaction" system.

## Work Streams

### Stream A: UI Component Implementation
**Type:** single-stream
**Agent:** general-purpose
**Files:**
- apps/web/src/app/inventory/page.tsx
- apps/web/src/components/inventory/TransactionTypeSelector.tsx (new)

**Work:**
1. Create TransactionTypeSelector component using Dialog from shadcn/ui
2. Replace "New Purchase" button with "Record Transaction" button
3. Implement 4 transaction type buttons with icons
4. Handle modal open/close state
5. Route to appropriate forms based on selection

## Implementation Details

### Component Structure
```
TransactionTypeSelector
├── Dialog wrapper
├── 4 Card buttons (grid layout)
│   ├── Apples (existing form)
│   ├── Additives (placeholder)
│   ├── Juice (placeholder)
│   └── Packaging (placeholder)
└── Close button
```

### Routing Logic
- Apples → Open existing purchase form (activeTab: "purchase")
- Others → Show placeholder "Coming soon" for now

## Dependencies
- No dependencies - can be implemented immediately
- Uses existing Dialog component from shadcn/ui
- Integrates with existing inventory page structure

## Coordination Points
- Single stream task - no coordination needed
- Will integrate with forms created in issues #52, #53, #54

## Risk Mitigation
- Keep existing purchase functionality intact
- Use placeholders for unimplemented forms
- Follow existing UI patterns for consistency