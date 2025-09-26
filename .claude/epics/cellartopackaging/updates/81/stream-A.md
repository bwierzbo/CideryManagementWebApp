---
issue: 81
stream: Button and Modal Component
agent: general-purpose
started: 2025-09-26T15:41:20Z
completed: 2025-09-26T16:20:00Z
status: completed
---

# Stream A: Button and Modal Component

## Scope
Add Bottle button to vessel cards and create basic modal component

## Files
- apps/web/src/app/cellar/page.tsx (add Bottle button) ✅
- apps/web/src/components/packaging/bottle-modal.tsx (new component) ✅

## Progress
✅ **COMPLETED** - All requirements implemented

### Implementation Details

#### BottleModal Component
- ✅ Created complete modal using shadcn Dialog
- ✅ All required fields per PRD:
  - Volume taken (L) with decimal support and max validation
  - Package size dropdown with 8 standard options (355ml to 50L kegs)
  - Units produced integer input
  - Computed loss display with real-time calculation
  - Date/time picker (defaults to current time)
  - Optional notes textarea (500 char max)
- ✅ Real-time loss calculation: `volumeTaken - (units × unitSize)`
- ✅ Color-coded loss status indicators:
  - Green: <2% loss (excellent)
  - Yellow: 2-5% loss (normal) or 5-10% (high)
  - Red: >10% loss (excessive) or negative loss (invalid)
- ✅ Form validation with Zod schema
- ✅ Proper TypeScript types and error handling

#### Cellar Page Integration
- ✅ Added "Bottle" button to vessel card dropdown actions
- ✅ Button disabled for vessels without active batches or empty vessels
- ✅ Uses Wine icon from lucide-react
- ✅ Proper state management for modal open/close
- ✅ Toast notifications for user feedback
- ✅ Handler functions for bottle action and form submission

### Technical Notes
- Modal follows existing UI patterns in codebase
- Uses shadcn components consistently
- Form validation prevents negative loss
- Submission handler ready for tRPC integration
- All TypeScript checks pass

### Commit
- Commit hash: 4317599
- Message: "Issue #81: Add Bottle button and modal component"
- Files: 2 files changed, 345 insertions(+), 1 deletion(-)

## Next Steps
Ready for backend integration (tRPC packaging router) in subsequent streams.