---
name: cellartopackaging
status: completed
created: 2025-09-26T14:06:41Z
updated: 2025-09-26T20:00:00Z
progress: 100%
prd: .claude/prds/cellartopackaging.md
github: https://github.com/bwierzbo/CideryManagementWebApp/issues/77
---

# Epic: Cellar to Packaging Flow

## Overview

Implement a streamlined bottling workflow that enables operators to package products directly from vessels via a minimal modal on `/cellar`, while providing comprehensive run management on `/packaging`. The solution leverages existing vessel and batch infrastructure, adds minimal new database tables, and focuses on atomic operations for reliability.

## Architecture Decisions

### Key Technical Decisions
1. **Minimal Modal Approach**: Add "Bottle" action to existing vessel cards rather than new page navigation
2. **Leverage Existing Infrastructure**: Reuse vessel status management, batch tracking, and inventory systems
3. **Atomic Transactions**: All packaging operations in single database transaction to prevent partial updates
4. **Progressive Enhancement**: Start with core functionality, add QA features progressively
5. **Reference Data Pattern**: Use package_sizes table for consistent dropdown options

### Technology Choices
- **Frontend**: React Hook Form for modal, existing shadcn/ui components
- **State**: Leverage existing tRPC mutations, minimal client state
- **Database**: PostgreSQL with proper indexes for performance
- **Validation**: Zod schemas shared between client and server

### Design Patterns
- **Optimistic Locking**: For vessel volume updates to prevent race conditions
- **Idempotency**: Check for duplicate runs within 5-minute window
- **Soft Deletes**: Maintain audit trail with void reason tracking
- **Generated Columns**: Use PostgreSQL computed columns for loss percentage

## Technical Approach

### Frontend Components

#### Cellar Page Enhancement
- Add "Bottle" button to vessel cards (only when batch present)
- Create BottleModal component similar to existing measurement/additive modals
- Reuse existing form patterns and validation
- Add success state with redirect option

#### Packaging Page Redesign
- Create new page layout with run list and detail views
- Implement URL-based routing for specific runs (`?runId=...`)
- Build reusable cards for Production, Traceability, QA sections
- Add export functionality using existing PDF/CSV patterns

### Backend Services

#### API Endpoints
- `packaging.createFromCellar`: Main mutation for bottling operation
- `packaging.get/list`: Query endpoints for viewing runs
- `packaging.updateQA`: Mutation for post-packaging QA updates
- Reuse existing inventory and audit services

#### Data Models
- New `packaging_runs` table with comprehensive fields
- Extend `inventory_items` with packaging fields
- Add `package_sizes` reference table
- Leverage existing vessel, batch, and user tables

#### Business Logic
- Volume validation and updates in single transaction
- Automatic status transitions (vessel → cleaning, batch → packaged)
- Lot code generation with sequential numbering
- Loss calculation with configurable thresholds

### Infrastructure

#### Database Performance
- Add indexes on foreign keys and date ranges
- Use database-level constraints for data integrity
- Implement proper locking for concurrent operations

#### Monitoring
- Track packaging operation duration
- Monitor loss percentages for anomalies
- Alert on validation failures

## Implementation Strategy

### Development Approach
1. **Database First**: Create schema and test with direct SQL
2. **API Layer**: Build tRPC endpoints with comprehensive testing
3. **Modal UI**: Implement cellar modal with basic functionality
4. **Packaging Page**: Build run management interface
5. **Integration**: Connect all pieces with end-to-end testing

### Risk Mitigation
- Use database transactions to prevent partial updates
- Implement retry logic for transient failures
- Add confirmation dialogs for high-loss scenarios
- Create comprehensive audit logging

### Testing Approach
- Unit tests for loss calculations and validations
- Integration tests for complete packaging flow
- Load tests for concurrent operations
- User acceptance testing with real operators

## Task Breakdown Preview

High-level implementation tasks (keeping it minimal and focused):

- [ ] **Task 1: Database Schema** - Create packaging tables, migrations, and seed data
- [ ] **Task 2: Package Sizes Reference** - Set up reference data and dropdown population
- [ ] **Task 3: Packaging API Router** - Implement createFromCellar mutation with validation
- [ ] **Task 4: Cellar Modal UI** - Add Bottle button and modal to vessel cards
- [ ] **Task 5: Packaging Page - List View** - Create index page with filtering and sorting
- [ ] **Task 6: Packaging Page - Detail View** - Build run detail cards and data display
- [ ] **Task 7: QA & Export Features** - Add QA field updates and PDF/CSV export
- [ ] **Task 8: Integration Testing** - Complete flow testing and edge cases
- [ ] **Task 9: Performance & Polish** - Optimize queries, add indexes, mobile testing

## Dependencies

### External Dependencies
- None - uses existing PostgreSQL, Next.js, tRPC stack

### Internal Dependencies
- Existing vessel management system (must be stable)
- Batch tracking functionality (already implemented)
- Inventory system (extend existing tables)
- User authentication and RBAC (already in place)

### Prerequisite Work
- Ensure vessel volumes are accurate (one-time data validation)
- Verify batch status tracking is working correctly
- Confirm inventory table structure can be extended

## Success Criteria (Technical)

### Performance Benchmarks
- Modal load time < 500ms
- Packaging operation completion < 2 seconds
- Page load with 1000 runs < 1 second
- Export generation < 5 seconds

### Quality Gates
- 100% test coverage for business logic
- Zero data loss during operations
- Audit trail for all changes
- Graceful handling of edge cases

### Acceptance Criteria
- Operators can package in < 30 seconds
- Vessel volumes update correctly every time
- Inventory items created with unique lot codes
- All required compliance fields captured

## Estimated Effort

### Overall Timeline
- **Total Duration**: 2-3 weeks with single developer
- **Critical Path**: Database → API → Modal → Packaging Page

### Development Breakdown
- Database & Migrations: 0.5 days
- API Implementation: 2 days
- Cellar Modal: 1 day
- Packaging Page: 3 days
- QA & Export: 1 day
- Testing & Polish: 2 days
- Documentation: 0.5 days

### Resource Requirements
- 1 full-stack developer
- Access to production-like data for testing
- User feedback sessions with operators
- Code review from senior developer

## Simplification Opportunities

### Leverage Existing Code
1. **Reuse Modal Patterns**: Copy structure from Add Measurement/Additive modals
2. **Extend Inventory System**: Don't create new inventory - extend existing
3. **Use Existing Export**: Adapt current CSV/PDF export utilities
4. **Copy Validation Patterns**: Reuse form validation from other pages

### Reduce Complexity
1. **Skip Analytics Dashboard**: Not needed for MVP, can add later
2. **Simple QA Fields**: Start with basic pass/fail, enhance later
3. **No Photo Upload Initially**: Can be added in future iteration
4. **Basic Export Formats**: Start with CSV only, add PDF if time permits

### Smart Defaults
1. **Auto-calculate Loss**: No manual entry needed
2. **Pre-select Common Sizes**: 355ml and 750ml cover 80% of use cases
3. **Default to Current Time**: Reduce fields to fill
4. **Single-vessel Only**: Don't complicate with multi-vessel bottling

## Tasks Created
- [ ] #78 - Database Schema and Migrations (parallel: true)
- [ ] #79 - Package Sizes Reference Data (parallel: false, depends on #78)
- [ ] #80 - Packaging API Router (parallel: false, depends on #78)
- [ ] #81 - Cellar Modal UI (parallel: false, depends on #79, #80)
- [ ] #82 - Packaging List Page (parallel: false, depends on #80)
- [ ] #83 - Packaging Detail View (parallel: false, depends on #80, #82)
- [ ] #84 - QA Updates and Export (parallel: false, depends on #80, #83)
- [ ] #85 - Integration Testing (parallel: false, depends on all)
- [ ] #86 - Performance and Polish (parallel: false, depends on #85)

Total tasks: 9
Parallel tasks: 1
Sequential tasks: 8
Estimated total effort: 56-72 hours