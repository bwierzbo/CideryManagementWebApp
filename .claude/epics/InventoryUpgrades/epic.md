---
name: InventoryUpgrades
status: backlog
created: 2025-09-19T14:58:32Z
progress: 0%
prd: .claude/prds/InventoryUpgrades.md
github: https://github.com/bwierzbo/CideryManagementWebApp/issues/49
---

# Epic: InventoryUpgrades

## Overview

Transform the existing apple-only purchase system into a unified inventory management platform by extending the current infrastructure. We'll leverage the existing vendor, purchase, and form patterns while adding support for additives, juice, and packaging materials. The solution focuses on minimal code changes by reusing existing components and patterns wherever possible.

## Architecture Decisions

### Leverage Existing Infrastructure
- **Reuse existing purchase/vendor infrastructure** - Extend current models rather than creating new systems
- **Use existing form patterns** - Copy apple purchase form structure for consistency
- **Extend current inventory table** - Add type column and filters to existing table structure
- **Maintain tRPC pattern** - Keep consistent with current API architecture

### Simplified Data Model
- **Single inventory table approach** - All material types in one table with type discriminator
- **Reuse vendor management** - Same vendor system for all material types
- **Common transaction structure** - Unified purchase transaction model with type-specific metadata

### UI/UX Consistency
- **Use existing shadcn/ui components** - No new component library additions
- **Follow current form validation patterns** - Leverage existing react-hook-form setup
- **Maintain current navigation structure** - Integrate seamlessly into existing inventory page

## Technical Approach

### Frontend Components

**Transaction Selector Component**
- Simple modal/dialog with 4 material type buttons
- Reuses existing Dialog component from shadcn/ui
- Routes to appropriate form based on selection

**Material-Specific Forms**
- Apple form: Keep existing implementation unchanged
- Additives/Juice/Packaging: Clone apple form structure with field modifications
- Share common components (vendor selector, date picker, etc.)

**Enhanced Inventory Table**
- Add "type" column to existing table
- Implement filter buttons above table (reuse existing button styles)
- Add search input using existing Input component
- Use existing pagination patterns

### Backend Services

**Extended API Endpoints**
- `inventory.recordTransaction` - Single endpoint handling all types
- `inventory.list` - Enhanced with type filtering and search
- Reuse existing vendor endpoints without modification

**Database Schema Updates**
- Add `material_type` enum to inventory table
- Add `metadata` JSONB field for type-specific data
- Minimal migration required - mostly additive changes

### Infrastructure
- No new infrastructure requirements
- Uses existing PostgreSQL and deployment setup
- Monitoring through existing patterns

## Implementation Strategy

### Development Approach
1. Start with database schema extension (non-breaking)
2. Build transaction selector UI component
3. Clone and modify apple form for other materials
4. Enhance inventory table with filters
5. Connect all pieces with existing tRPC patterns

### Risk Mitigation
- Keep apple purchase flow unchanged initially
- Add new features alongside existing ones
- Gradual rollout with feature flag if needed

### Testing Approach
- Unit tests for new form validations
- Integration tests for transaction recording
- E2E tests for critical user flows
- Reuse existing test infrastructure

## Task Breakdown Preview

Simplified task list focusing on essential implementation:

- [ ] **Task 1: Database Schema Extension** - Add material_type enum and metadata field to inventory/purchase tables
- [ ] **Task 2: Transaction Type Selector UI** - Create modal with 4 buttons to select transaction type
- [ ] **Task 3: Additives Transaction Form** - Clone apple form, modify fields for additives
- [ ] **Task 4: Juice Transaction Form** - Clone apple form, modify fields for juice purchases
- [ ] **Task 5: Packaging Transaction Form** - Clone apple form, modify fields for packaging
- [ ] **Task 6: Unified API Endpoint** - Create single recordTransaction endpoint handling all types
- [ ] **Task 7: Enhanced Inventory Table** - Add type column, search box, and filter buttons
- [ ] **Task 8: Table Sorting & Search** - Implement column sorting and real-time search
- [ ] **Task 9: Integration & Testing** - Connect all components, write tests, fix bugs

Total: 9 focused tasks leveraging existing infrastructure

## Dependencies

### Internal Dependencies
- Existing vendor management system (already in place)
- Current purchase order workflow (reusing)
- Authentication system (no changes needed)
- Existing form validation patterns (copying)

### External Dependencies
- None for Phase 1

### Data Dependencies
- No complex migrations needed
- Existing apple data remains unchanged
- New fields are additive only

## Success Criteria (Technical)

### Performance Benchmarks
- Inventory table loads < 2 seconds with 5,000 items
- Search responds < 300ms
- Form submission < 1 second
- Zero regression on existing apple purchases

### Quality Gates
- All existing tests continue passing
- New forms have 80%+ code coverage
- No breaking changes to existing APIs
- Mobile responsive on all new components

### Acceptance Criteria
- Can record all 4 transaction types
- Can search and filter inventory by type
- Can sort by any column
- Existing apple workflow unchanged

## Estimated Effort

### Timeline: 3-4 weeks
- Week 1: Database changes and transaction selector
- Week 2: Three new forms (additives, juice, packaging)
- Week 3: Inventory table enhancements and API
- Week 4: Testing, bug fixes, and polish

### Resource Requirements
- 1-2 developers
- Minimal database migration downtime
- No additional infrastructure costs

### Critical Path Items
1. Database schema extension (blocks everything)
2. Transaction selector UI (blocks forms)
3. API endpoint (blocks integration)
4. Inventory table enhancements (blocks search/filter)

## Simplifications & Improvements

### Identified Simplifications
- Reuse vendor system instead of creating material-specific vendors
- Single inventory table instead of separate tables per type
- Clone existing forms instead of building from scratch
- Use JSONB for flexibility instead of rigid schema

### Code Reuse Opportunities
- Vendor selection component used across all forms
- Date picker component shared
- Validation patterns copied from apple form
- Table sorting logic reused from existing tables

### Future Optimization Points
- Can add type-specific views later if needed
- Bulk import can be added as enhancement
- Advanced analytics as separate feature
- API integration deferred to later phase

## Tasks Created
- [ ] #50 - Database Schema Extension (parallel: true)
- [ ] #51 - Transaction Type Selector UI (parallel: true)
- [ ] #52 - Additives Transaction Form (parallel: true)
- [ ] #53 - Juice Transaction Form (parallel: true)
- [ ] #54 - Packaging Transaction Form (parallel: true)
- [ ] #55 - Unified API Endpoint (parallel: false)
- [ ] #56 - Enhanced Inventory Table (parallel: false)
- [ ] #57 - Table Sorting & Search (parallel: false)
- [ ] #58 - Integration & Testing (parallel: false)

Total tasks: 9
Parallel tasks: 5
Sequential tasks: 4
Estimated total effort: 58 hours
