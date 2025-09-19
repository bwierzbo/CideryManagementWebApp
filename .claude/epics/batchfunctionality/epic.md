---
name: batchfunctionality
status: backlog
created: 2025-09-19T20:42:32Z
progress: 0%
prd: .claude/prds/batchfunctionality.md
github: https://github.com/bwierzbo/CideryManagementWebApp/issues/59
---

# Epic: Batch Functionality

## Overview

Implement a first-class batch abstraction that automatically tracks liquid contents throughout the cidery production lifecycle. The system leverages existing vessel, tank measurement, and audit infrastructure to create batches when juice is assigned to vessels and tracks all operations as events until packaging completion.

**Key Insight:** Rather than building entirely new systems, we'll extend existing tank measurements and additives into a unified batch event system, minimizing new code while maximizing functionality.

## Architecture Decisions

### Core Design Patterns
- **Event Sourcing**: All batch operations stored as immutable events with full audit trail
- **State Reconstruction**: Batch status derived from event history rather than maintained state
- **Existing Infrastructure Reuse**: Leverage existing vessel management, tank measurements, and audit systems

### Technology Choices
- **Database**: Extend existing Drizzle schema with batch and batch_events tables
- **API Layer**: Add batch routes to existing tRPC setup with vessel integration
- **Frontend**: Replace placeholder tab in existing /cellar page with React components
- **State Management**: Use existing TanStack Query patterns for batch data

### Integration Strategy
- **Automatic Creation**: Hook into existing PressRun completion workflow
- **Event Logging**: Extend existing tank measurement/additive forms to create batch events
- **Audit Trail**: Leverage existing audit system for all batch operations
- **RBAC**: Use existing role-based access control patterns

## Technical Approach

### Frontend Components
- **BatchDetailsTab**: Replace placeholder in /cellar page, shows batch overview and timeline
- **BatchEventTimeline**: Chronological display of all batch events with type-specific rendering
- **FermentationCurve**: Chart component for SG/ABV visualization over time
- **BatchEventForms**: Extend existing measurement/additive forms to create batch events

### Backend Services
- **Batch Management**: tRPC router for batch CRUD operations and lifecycle management
- **Event System**: Batch event creation, querying, and validation with audit integration
- **Auto-Creation Service**: PressRun completion hook to automatically create batches
- **Transfer Operations**: Vessel-to-vessel transfer handling with batch continuity

### Database Schema
- **batches table**: Core batch records with lifecycle tracking (status, vessels, dates)
- **batch_events table**: Event sourcing for all batch operations with polymorphic event data
- **Foreign Keys**: Link to existing vessels, juice_lots, press_runs, packaging_runs
- **Indexes**: Optimized for timeline queries and batch lookups

## Implementation Strategy

### Development Approach
- **Incremental Integration**: Build on existing systems rather than replacing them
- **Event-First Design**: All batch operations flow through event creation for consistency
- **Zero-Downtime Deployment**: New tables and optional features, existing systems unchanged

### Risk Mitigation
- **Performance**: Index strategy for large event datasets, pagination for timeline display
- **Data Consistency**: Database constraints and validation at multiple layers
- **User Adoption**: Minimal workflow changes, extend existing interfaces

### Testing Strategy
- **Unit Tests**: Event validation, batch lifecycle logic, ABV calculations
- **Integration Tests**: PressRun→Batch creation, measurement→event flow, transfer operations
- **E2E Tests**: Complete user workflows in /cellar page with real data scenarios

## Task Breakdown Preview

High-level task categories (8 total):

- [ ] **Database Schema**: Create batches and batch_events tables with proper relationships and indexes
- [ ] **Batch API Layer**: Implement tRPC routes for batch CRUD, events, and lifecycle operations
- [ ] **Auto-Creation Integration**: Hook PressRun completion to automatically create batches
- [ ] **Event System**: Extend tank measurement/additive workflows to create batch events
- [ ] **Batch Details UI**: Replace /cellar placeholder tab with functional batch interface
- [ ] **Event Timeline Component**: Build chronological display of batch events with visualization
- [ ] **Fermentation Curve**: Create SG/ABV chart component with real-time updates
- [ ] **Transfer Operations**: Implement vessel-to-vessel transfers with batch continuity

## Dependencies

### External Service Dependencies
- **Existing PressRun System**: Must hook completion workflow for auto-creation
- **PackagingRun System**: Required for batch closure integration
- **Vessel Management**: Batch-vessel relationships and transfer operations
- **Audit System**: All batch events must integrate with existing audit logging

### Internal Team Dependencies
- **Database Team**: Schema migration and performance optimization for batch queries
- **API Team**: Integration with existing tRPC infrastructure and vessel operations
- **Frontend Team**: /cellar page integration and component development

### Prerequisite Work
- Tank measurement forms completed (✅ already done)
- Vessel management system stable
- PressRun completion workflow accessible for hooks

## Success Criteria (Technical)

### Performance Benchmarks
- Batch event timeline queries: <500ms for 1000+ events
- Fermentation curve rendering: <200ms for 100+ data points
- Batch auto-creation: <50ms additional overhead on PressRun completion
- Database queries: Efficient with proper indexing for 10K+ batches

### Quality Gates
- 95%+ test coverage for batch-related code
- Zero data loss during vessel transfers
- All batch operations atomic and consistent
- RBAC permissions properly enforced
- Audit trail complete for all events

### Acceptance Criteria
- 100% automatic batch creation on juice assignment
- All vessel operations logged as batch events
- Transfers update batch location without data loss
- PackagingRun properly closes batches
- UI responsive and intuitive for operators

## Estimated Effort

### Overall Timeline
- **6 weeks total development**
- **2 weeks testing and rollout**
- **8 weeks end-to-end delivery**

### Resource Requirements
- **2 full-stack engineers** (database + API + frontend)
- **1 QA engineer** for production data testing
- **Part-time UI/UX** for /cellar page design

### Critical Path Items
1. Database schema implementation (Week 1)
2. PressRun auto-creation integration (Week 2)
3. Event system and API development (Weeks 3-4)
4. Frontend batch details implementation (Weeks 5-6)
5. Integration testing and deployment (Weeks 7-8)

### Risk Buffer
- **+1 week** for performance optimization if needed
- **+1 week** for complex transfer operation edge cases
- **+1 week** for user training and adoption support
## Tasks Created
- [ ] #60 - Database Schema Implementation - Create batches and batch_events tables (parallel: true)
- [ ] #61 - Batch API Layer - Implement tRPC routes for batch CRUD and lifecycle operations (parallel: false)
- [ ] #62 - Auto-Creation Integration - Hook PressRun completion to automatically create batches (parallel: false)
- [ ] #63 - Event System Integration - Extend tank measurement/additive workflows to create batch events (parallel: false)
- [ ] #64 - Batch Details UI - Replace /cellar placeholder tab with functional batch interface (parallel: false)
- [ ] #65 - Event Timeline Component - Build chronological display of batch events with visualization (parallel: true)
- [ ] #66 - Fermentation Curve - Create SG/ABV chart component with real-time updates (parallel: true)
- [ ] #67 - Transfer Operations - Implement vessel-to-vessel transfers with batch continuity (parallel: false)

Total tasks: 8
Parallel tasks: 3
Sequential tasks: 5
