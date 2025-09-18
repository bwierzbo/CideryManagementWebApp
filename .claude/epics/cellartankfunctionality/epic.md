---
name: cellartankfunctionality
status: completed
created: 2025-09-17T05:24:30Z
completed: 2025-09-17T09:55:00Z
progress: 100%
prd: .claude/prds/cellartankfunctionality.md
github: https://github.com/bwierzbo/CideryManagementWebApp/issues/32
---

# Epic: Cellar Tank Functionality

## Overview

Implement comprehensive tank management system building on existing vessel infrastructure. Focus on automated status management, measurement tracking, and additive recording with minimal new code by leveraging existing patterns from apple press system. Mobile-first design for production floor usage with real-time status updates and intelligent workflows.

## Architecture Decisions

### Leverage Existing Infrastructure
- **Extend Current Vessel System**: Build on existing vessels table and tRPC patterns rather than creating new entities
- **Reuse Status Management**: Extend existing vessel status enum with new states (empty, fermenting, storing, aging)
- **Follow Apple Press Patterns**: Use similar mobile-optimized action patterns and form handling from press run system
- **Utilize Existing RBAC**: No new permissions needed - leverage existing user role system

### Database Strategy
- **Minimal Schema Changes**: Add new status values to existing enum, create two simple tracking tables
- **Audit-First Design**: All actions tracked with timestamp and user attribution using existing audit patterns
- **Relational Integrity**: Link measurements and additives to vessels, not batches, for tank-centric workflow

### Mobile-First Architecture
- **Action-Based UI**: Follow established pattern from press runs with "Add Measurement", "Add Additive", "Change Status" actions
- **Real-Time Updates**: Use existing tRPC subscription patterns for status changes
- **Offline Capability**: Not required per PRD - focus on reliable online experience

## Technical Approach

### Frontend Components

#### Tank Dashboard
- **Extend existing vessel views** with new status indicators and action buttons
- **Color-coded status system**: Visual indicators for empty/fermenting/storing/aging/cleaning/maintenance
- **Tank action menu**: Mobile-optimized buttons for common operations

#### Tank Action Forms
- **Measurement Form**: Optional fields for Temp(C), SH, pH, %ABV with form validation
- **Additive Form**: Dropdown for additive types, quantity input with unit selection
- **Status Change Form**: Simple status selection with automatic validation rules

#### Historical Views
- **Measurement Timeline**: Chart view showing measurements over time for tank contents
- **Additive History**: Chronological list of all additions with quantities and notes

### Backend Services

#### tRPC Router Extensions
- **tank router**: CRUD operations for tank management, status updates, action recording
- **tankMeasurements router**: Create, read, and trend analysis endpoints
- **tankAdditives router**: Addition tracking and history retrieval

#### Business Logic
- **Automatic Status Updates**: Trigger status changes on juice addition/transfer completion
- **Volume Tracking**: Calculate current tank contents from press runs and transfers
- **Validation Rules**: Ensure additives only added to tanks with juice content

#### Database Schema Updates
```sql
-- Extend existing vessel_status enum
ALTER TYPE vessel_status ADD VALUE 'empty';
ALTER TYPE vessel_status ADD VALUE 'fermenting';
ALTER TYPE vessel_status ADD VALUE 'storing';
ALTER TYPE vessel_status ADD VALUE 'aging';

-- New measurement tracking table
CREATE TABLE tank_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vessel_id UUID NOT NULL REFERENCES vessels(id),
  temp_c DECIMAL(5,2),
  sh DECIMAL(5,2),
  ph DECIMAL(4,2),
  abv DECIMAL(5,2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- New additive tracking table
CREATE TABLE tank_additives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vessel_id UUID NOT NULL REFERENCES vessels(id),
  additive_type TEXT NOT NULL,
  amount DECIMAL(10,3) NOT NULL,
  unit TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);
```

### Infrastructure

#### Integration Points
- **Press Run Integration**: Automatic tank status update when juice assigned to vessel
- **Transfer System**: Auto-status updates when transfers empty/fill tanks
- **Existing Audit System**: Leverage current audit logging patterns

#### Performance Considerations
- **Efficient Queries**: Index on vessel_id for measurement and additive lookups
- **Real-time Updates**: Use existing tRPC subscription infrastructure
- **Mobile Optimization**: Minimal payload sizes for tank status updates

## Implementation Strategy

### Phase 1: Core Tank Status (Week 1)
- Database schema updates and migrations
- Extend vessel status enum with new values
- Basic status change functionality
- Automatic status updates on juice addition/transfer

### Phase 2: Measurement System (Week 2)
- Tank measurements table and API endpoints
- Mobile measurement form component
- Historical measurement views and trends
- Integration with tank dashboard

### Phase 3: Additive Tracking (Week 3)
- Tank additives table and tracking system
- Additive form with type selection and quantities
- Historical additive timeline view
- Complete tank action integration

### Risk Mitigation
- **Database Migration**: Test enum additions in development first
- **Status Logic**: Comprehensive unit tests for automatic status transitions
- **Mobile Performance**: Progressive enhancement for older devices
- **Data Integrity**: Foreign key constraints and validation rules

### Testing Approach
- **Unit Tests**: All business logic for status transitions and validations
- **Integration Tests**: End-to-end tank workflows from creation to cleaning
- **Mobile Testing**: Responsive design verification across device sizes
- **Performance Tests**: Load testing with realistic tank counts (100+ vessels)

## Task Breakdown Preview

High-level task categories that will be created:
- [ ] **Database Schema Updates**: Extend vessel status enum, create measurement and additive tables
- [ ] **Tank Status Management**: Implement automatic status transitions and manual overrides
- [ ] **Measurement Recording System**: Create forms, API endpoints, and historical views
- [ ] **Additive Tracking System**: Build additive forms, validation, and history timeline
- [ ] **Tank Dashboard Integration**: Extend existing vessel views with new status indicators and actions
- [ ] **Mobile UI Components**: Build responsive action forms and tank management interface
- [ ] **API Integration**: Extend tRPC routers with tank-specific endpoints
- [ ] **Testing & Documentation**: Comprehensive test coverage and user documentation

## Dependencies

### Internal Dependencies
- **Existing Vessel System**: Must be stable before extending
- **tRPC Infrastructure**: Relies on current API patterns
- **User Authentication**: Uses existing RBAC system
- **Transfer System**: Integration point for automatic status updates

### External Dependencies
- **Mobile Device Access**: Production staff need tablets/phones
- **Database Migration**: PostgreSQL enum extension support
- **Development Environment**: Local testing of status transitions

### Prerequisite Work
- **None** - can build immediately on existing infrastructure
- **Optional**: Apple press system completion for integration testing

## Success Criteria (Technical)

### Performance Benchmarks
- Tank status updates complete within 500ms
- Measurement form submission under 1 second
- Dashboard loads 100+ tanks within 2 seconds
- Mobile interface responsive on devices 2+ years old

### Quality Gates
- 90%+ test coverage on all new business logic
- Zero SQL injection vulnerabilities
- RBAC enforcement on all tank operations
- Comprehensive audit logging for all actions

### Acceptance Criteria
- All tank statuses update automatically per business rules
- Measurement history persists across tank transfers
- Additive tracking complete with quantities and timestamps
- Mobile interface passes accessibility standards

## Estimated Effort

### Overall Timeline
- **Total Duration**: 3 weeks (3 developers)
- **MVP Delivery**: 2 weeks (core functionality)
- **Polish & Testing**: 1 week (refinement)

### Resource Requirements
- **Backend Developer**: 2 weeks (schema, API, business logic)
- **Frontend Developer**: 2.5 weeks (mobile UI, dashboard integration)
- **Full-Stack Developer**: 1 week (integration, testing, documentation)

### Critical Path Items
1. Database schema migration (Week 1, Day 1-2)
2. Tank status automation logic (Week 1, Day 3-5)
3. Mobile measurement forms (Week 2, Day 1-3)
4. Integration testing (Week 3, Day 1-2)

### Risk Contingency
- **+25% buffer** for mobile UI complexity
- **+10% buffer** for database migration issues
- **Parallel development** possible after schema completion

The implementation leverages existing infrastructure heavily, minimizing new code while delivering comprehensive tank management functionality. Focus on proven patterns from apple press system ensures reliable delivery within timeline.

## Tasks Created
- [ ] #33 - Database Schema Updates (parallel: true)
- [ ] #34 - Tank Status Management (parallel: false, depends on #33)
- [ ] #35 - API Integration (parallel: true)
- [ ] #36 - Measurement Recording System (parallel: true, depends on #34, #35)
- [ ] #37 - Additive Tracking System (parallel: true, depends on #34, #35)
- [ ] #38 - Tank Dashboard Integration (parallel: true, depends on #34, #35)
- [ ] #39 - Mobile UI Components (parallel: true, depends on #36, #37)
- [ ] #40 - Testing & Documentation (parallel: false, depends on #33-#39)

Total tasks: 8
Parallel tasks: 6
Sequential tasks: 2
Estimated total effort: 134 hours