---
name: bottlingcider
status: failed
created: 2025-09-25T21:28:19Z
updated: 2025-09-26T13:58:25Z
closed: 2025-09-26T13:58:25Z
progress: 0%
prd: .claude/prds/bottlingcider.md
github: https://github.com/bwierzbo/CideryManagementWebApp/issues/68
failure_reason: "Parallel worker agents reported false completion without actual implementation"
---

# Epic: Bottling Flow Implementation

## Overview

Implement a streamlined bottling workflow that adds a minimal "Bottle" action to the `/cellar` page via a modal, while providing comprehensive packaging run management on a redesigned `/packaging` page. The solution leverages existing patterns (modal actions like "Add Measurement"), reuses current inventory infrastructure, and maintains data integrity through atomic transactions.

## Architecture Decisions

### Key Technical Decisions

1. **Modal Pattern Reuse**: Leverage existing modal infrastructure from "Add Measurement" and "Add Additive" actions for consistency and reduced development
2. **Atomic Transaction Design**: All bottling operations wrapped in database transactions to ensure data consistency
3. **Inventory Extension**: Extend existing inventory system rather than creating parallel structures
4. **Simple State Management**: Use existing vessel status enum with new "Cleaning" state
5. **Lot Code Generation**: Server-side generation using deterministic format for consistency

### Technology Choices

- **Frontend**: React Hook Form for modal, existing shadcn/ui components
- **API**: tRPC procedures with Zod validation for type safety
- **Database**: PostgreSQL with Drizzle ORM, leveraging existing schema patterns
- **Export**: Reuse existing PDF/CSV export utilities from reports

### Design Patterns

- **Optimistic UI Updates**: Show immediate feedback while server processes
- **Progressive Enhancement**: Basic flow works first, QA features added incrementally
- **Command Pattern**: Single atomic operation for all bottling side effects

## Technical Approach

### Frontend Components

**Minimal /cellar Changes:**
- Add "Bottle" button to vessel card (conditional on active batch)
- Create `BottlingModal` component using existing modal patterns
- Form validation with react-hook-form and Zod
- Real-time loss calculation in modal
- Success handling with redirect options

**Redesigned /packaging Page:**
- Reuse existing table components for run index
- Create unified `PackagingRunView` component
- Leverage existing export infrastructure
- Use existing audit trail viewer pattern

### Backend Services

**API Endpoints (tRPC):**
```typescript
// Single atomic operation for bottling
packaging.createFromCellar:
  - Validates vessel volume availability
  - Creates PackagingRun record
  - Updates vessel volume and status
  - Creates inventory items with lot codes
  - Writes audit logs
  - Returns run details for redirect

// Existing pattern reuse
packaging.get: Standard detail fetch
packaging.list: Paginated list with filters
packaging.updateQA: Admin-only update
```

**Data Models:**
- `packaging_runs` table following existing schema patterns
- Extend `inventory_items` with minimal new columns
- Reuse existing audit logging infrastructure

### Infrastructure

**Deployment Considerations:**
- No new services required
- Database migration via existing Drizzle system
- No external dependencies

**Scaling Requirements:**
- Pessimistic locking for concurrent bottling
- Indexed queries for packaging run lookups
- Existing caching patterns apply

## Implementation Strategy

### Development Phases

**Phase 1: Core Flow (Days 1-3)**
- Database schema and migration
- Basic modal on /cellar
- Minimal API implementation
- Simple /packaging run view

**Phase 2: Complete Features (Days 4-5)**
- QA fields and compliance
- Export functionality
- Run index with filters
- Mobile optimization

**Phase 3: Polish (Day 6)**
- Loss warnings
- Performance optimization
- Documentation

### Risk Mitigation

1. **Concurrent Operations**: Use row-level locks during vessel updates
2. **Data Validation**: Server-side recalculation of all values
3. **User Errors**: Confirmation dialogs for destructive actions

### Testing Approach

- Unit tests for loss calculations and validations
- Integration tests for atomic transaction flow
- E2E test for complete bottling workflow
- Manual testing on mobile devices

## Task Breakdown Preview

Simplified implementation focusing on leveraging existing patterns:

- [ ] **Task 1: Database Schema** - Create packaging_runs table, extend inventory_items, add Cleaning status to vessel enum (0.5 day)
- [ ] **Task 2: Bottling Modal Component** - Create modal using existing patterns, integrate with vessel cards on /cellar (1 day)
- [ ] **Task 3: Core API Implementation** - Implement createFromCellar with atomic transaction, vessel updates, inventory creation (1 day)
- [ ] **Task 4: Packaging Run View** - Create /packaging run detail view with production, traceability, and QA cards (1 day)
- [ ] **Task 5: Packaging Index Page** - List view with filters, sorting, and basic search (0.5 day)
- [ ] **Task 6: Export Functionality** - Add PDF/CSV export using existing report infrastructure (0.5 day)
- [ ] **Task 7: Validation & Guards** - Add overdraw protection, loss warnings, concurrent bottling locks (0.5 day)
- [ ] **Task 8: Mobile Optimization & Testing** - Ensure responsive design, touch optimization, comprehensive testing (1 day)

Total: 8 tasks, ~6 days of focused development

## Dependencies

### Internal Dependencies
- Existing batch management system (must be operational)
- Current inventory system (for extension)
- Audit logging system (already in place)
- Export utilities (PDF/CSV generation)

### External Dependencies
- None - all functionality uses existing infrastructure

### Prerequisite Work
- Ensure vessels have currentVolumeL field populated
- Verify inventory system handles finished goods

## Success Criteria (Technical)

### Performance Benchmarks
- Modal load time < 500ms
- Bottling operation < 2 seconds
- No performance regression on /cellar page

### Quality Gates
- 100% transaction atomicity (no partial updates)
- Zero data loss on concurrent operations
- All calculations match on client and server

### Acceptance Criteria
- Operators can bottle in < 30 seconds
- Vessel volumes always accurate
- Complete audit trail for compliance
- Works on tablet devices

## Estimated Effort

### Timeline
- **Total Duration**: 6-7 business days
- **Developer Resources**: 1 full-stack developer
- **Critical Path**: Database schema → API → Modal → Testing

### Resource Requirements
- Full-stack developer familiar with existing codebase
- QA tester for mobile and edge cases
- Brief operator training (< 1 hour)

### Simplification Opportunities
- Reuse existing modal patterns reduces UI development by 50%
- Leveraging current inventory system eliminates complex integration
- Using existing export utilities saves 2+ days of development
- Following established patterns reduces review cycles

## Notes on Simplification

This implementation has been optimized to:
1. **Maximize reuse** of existing components and patterns
2. **Minimize new code** by extending rather than creating systems
3. **Reduce complexity** through atomic operations vs distributed updates
4. **Leverage infrastructure** already proven in production
5. **Focus on essentials** with QA features as progressive enhancement

The approach transforms what could be a 3-week project into a focused 6-day sprint by intelligently reusing existing functionality.

## Tasks Created
- [ ] #69 - Database Schema and Migration (parallel: true)
- [ ] #70 - Bottling Modal Component (parallel: true)
- [ ] #71 - Core API Implementation (parallel: false, depends on #69)
- [ ] #72 - Packaging Run View (parallel: false, depends on #71)
- [ ] #73 - Packaging Index Page (parallel: false, depends on #71)
- [ ] #74 - Export Functionality (parallel: true, depends on #72)
- [ ] #75 - Validation & Guards (parallel: true, depends on #71)
- [ ] #76 - Mobile Optimization & Testing (parallel: false, depends on #70, #72, #73)

Total tasks: 8
Parallel tasks: 4
Sequential tasks: 4
Estimated total effort: 48 hours (~6 days)