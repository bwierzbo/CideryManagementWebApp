---
issue: 81
title: Cellar Modal UI
analyzed: 2025-09-26T15:41:20Z
epic: cellartopackaging
---

# Issue #81: Cellar Modal UI - Analysis

## Work Streams

### Stream A: Button and Modal Component
**Agent Type**: general-purpose
**Files**:
- apps/web/src/app/cellar/page.tsx (add Bottle button to vessel cards)
- apps/web/src/components/packaging/bottle-modal.tsx (new modal component)

**Work**:
1. Add "Bottle" button to vessel cards in cellar page
2. Create BottleModal component using shadcn Dialog
3. Basic modal structure with form layout
4. Handle modal open/close states

### Stream B: Form Logic and API Integration
**Agent Type**: general-purpose
**Files**:
- apps/web/src/components/packaging/bottle-modal.tsx (extend with form logic)
- apps/web/src/lib/validations/packaging.ts (new validation schemas)

**Work**:
1. Implement React Hook Form with Zod validation
2. Integrate tRPC packaging.createFromCellar mutation
3. Add package size dropdown with getPackageSizes query
4. Handle success/error states and redirects

## Dependencies
- Stream B depends on Stream A (needs modal component first)
- Both streams need API from #80 and package sizes from #79

## Coordination Notes
- Stream A creates the modal component file
- Stream B extends it with business logic
- Both modify bottle-modal.tsx but in different phases