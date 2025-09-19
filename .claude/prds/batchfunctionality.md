---
name: batchfunctionality
description: Comprehensive batch tracking system for vessel-based liquid management and fermentation monitoring
status: backlog
created: 2025-09-19T20:30:01Z
---

# PRD: Batch Functionality

## Executive Summary

The Batch Functionality feature introduces a first-class "batch" abstraction to track liquid contents throughout the cidery production lifecycle. A batch represents the liquid inside a vessel from juice assignment through fermentation to final packaging. This system automatically creates batches when vessels receive juice and tracks all subsequent operations (measurements, additives, transfers) as batch events until packaging completion.

**Value Proposition:** Provides complete traceability and operational history for each batch of cider, enabling accurate COGS calculation, quality tracking, and production analytics.

## Problem Statement

### What problem are we solving?
Currently, the cidery management system can press juice into vessels but lacks a cohesive "batch" abstraction. Without this, there's no reliable way to:
- Track fermentation progress and history
- Record additives and measurements against specific liquid batches
- Maintain continuity when liquid moves between vessels
- Calculate accurate COGS per batch
- Provide traceability from juice lots to final packaged products

### Why is this important now?
The `/cellar` page has a placeholder "Batch Details" tab that needs real functionality. Without proper batch tracking, operators cannot effectively monitor fermentation progress, track quality metrics, or generate accurate production reports. This gap prevents the system from supporting core cidery operations.

## User Stories

### Primary User Personas
1. **Cidery Operators** - Monitor fermentation, record measurements, manage transfers
2. **Production Managers** - Track batch progress, analyze yields, review costs
3. **Quality Control** - Monitor fermentation curves, track additive history

### Detailed User Journeys

**Story 1: Automatic Batch Creation**
- As an operator, when I complete a press run that assigns juice to an empty vessel
- The system automatically creates a new batch record
- So I can immediately begin tracking fermentation without manual setup

**Story 2: Fermentation Monitoring**
- As an operator, when I select a vessel with an active batch in the cellar view
- I can see the batch timeline, fermentation curve, and current metrics
- So I can monitor fermentation progress and take appropriate actions

**Story 3: Recording Measurements**
- As an operator, when I take fermentation measurements (SG, pH, temperature)
- I can record them through the batch details interface
- So the system tracks fermentation progress and calculates ABV automatically

**Story 4: Vessel Transfers**
- As an operator, when I need to transfer liquid between vessels
- I can log the transfer which updates the batch's vessel location
- So the batch history remains intact across vessel changes

**Story 5: Batch Completion**
- As an operator, when I package a batch into bottles/kegs/cans
- The system closes the batch and creates inventory records
- So the batch lifecycle is complete and ready for COGS analysis

## Requirements

### Functional Requirements

#### Core Batch Management
- **BR-1:** Automatically create batch when PressRun assigns JuiceLot to empty vessel
- **BR-2:** Maintain batch continuity across vessel transfers
- **BR-3:** Close batch only when PackagingRun consumes the liquid
- **BR-4:** Support batch status transitions: planned → active → packaged

#### Batch Events System
- **BE-1:** Log all vessel operations as BatchEvents with types: measurement, additive, transfer, blend, statusChange, packaging
- **BE-2:** Store event-specific details (measurements: SG/Brix/pH/Temp, additives: name/type/amount/unit, transfers: vessels/volume/loss)
- **BE-3:** Maintain chronological timeline of all batch events
- **BE-4:** Update batch.vesselId on transfer events

#### User Interface
- **UI-1:** Replace placeholder "Batch Details" tab in /cellar page
- **UI-2:** Display batch metadata, event timeline, and fermentation curve when vessel has active batch
- **UI-3:** Show "No active batch" message for empty vessels
- **UI-4:** Provide action buttons: Add Measurement, Add Additive, Transfer, Close via Packaging
- **UI-5:** Generate fermentation curve graph from SG measurements over time

#### Data Integration
- **DI-1:** Link batches to JuiceLots for traceability
- **DI-2:** Connect PackagingRuns to batch closure
- **DI-3:** Provide batch ID for COGS and inventory reporting
- **DI-4:** Calculate ABV from SG measurements automatically

### Non-Functional Requirements

#### Performance
- Batch event queries must complete under 500ms for timeline display
- Fermentation curve rendering must handle 100+ measurement points smoothly
- Batch creation must be atomic with PressRun completion

#### Security & Access Control
- **Admin:** Full CRUD on batch records and events
- **Operator:** Create/read batch events, no delete permissions
- **Viewer:** Read-only access to batch data

#### Data Integrity
- Batch-to-vessel relationships must be consistent
- Event timestamps must be immutable once created
- Batch closure must be irreversible

#### Scalability
- Support 1000+ active batches simultaneously
- Handle 10,000+ batch events per batch
- Maintain performance with 5+ years of historical data

## Success Criteria

### Measurable Outcomes
1. **Operational Efficiency**
   - 100% of juice assignments automatically create batches
   - 0 manual batch creation steps required
   - 95% operator adoption of batch tracking within 30 days

2. **Data Quality**
   - 100% of vessel operations logged as batch events
   - 0 batch continuity breaks during transfers
   - 100% traceability from JuiceLot to PackagingRun

3. **User Experience**
   - <2 clicks to access batch details from vessel view
   - <30 seconds to record measurements
   - Real-time fermentation curve updates

### Key Metrics and KPIs
- Batch completion rate (target: 95%)
- Average time from batch start to packaging (baseline establishment)
- Number of measurements per batch (target: 10+ for quality batches)
- Yield variance accuracy (target: <5% difference from actual)

## Constraints & Assumptions

### Technical Limitations
- Must work within existing vessel/PressRun infrastructure
- Cannot modify core JuiceLot or PackagingRun schemas significantly
- Must maintain audit logging for all operations

### Timeline Constraints
- MVP delivery in 6-8 weeks
- Phased rollout with existing production systems
- No downtime for data migration

### Resource Limitations
- Development team of 2-3 engineers
- QA testing with real production data
- User training during implementation

### Assumptions
- Operators will consistently record measurements
- Vessel transfers are infrequent (<5% of batch operations)
- Packaging runs reliably close batches
- Existing audit system can handle increased event volume

## Out of Scope

### Explicitly NOT Building
- **Labor tracking** - No time/cost tracking for manual operations
- **Automated reminders** - No alerts or notifications for measurement schedules
- **Sensor/IoT integration** - No automatic data collection from sensors
- **Recipe management** - No multi-ingredient batch formulations
- **Batch splitting/merging** - Single vessel to single batch relationship only
- **Advanced analytics** - No predictive modeling or ML features
- **Mobile optimization** - Desktop-first implementation
- **Multi-batch blending** - Blend operations treated as additives only

## Dependencies

### External Dependencies
- Existing PressRun completion workflow
- PackagingRun system for batch closure
- Vessel management infrastructure
- Audit logging system

### Internal Team Dependencies
- Database team: Schema updates for BatchEvents table
- Frontend team: /cellar page batch details tab implementation
- API team: Batch CRUD operations and event logging
- QA team: Production data testing and validation

### Third-party Dependencies
- None identified for MVP

## Technical Architecture

### Database Schema Changes
- New `batches` table with lifecycle tracking
- New `batch_events` table for operation history
- Foreign key relationships to vessels, juice_lots, packaging_runs
- Indexes for performance on batch_id and timestamp queries

### API Endpoints
- POST /api/batches (automatic creation)
- GET /api/batches/:id (details and events)
- POST /api/batches/:id/events (log operations)
- PUT /api/batches/:id/transfer (vessel changes)
- PUT /api/batches/:id/close (packaging completion)

### Frontend Components
- BatchDetailsTab component for /cellar page
- BatchTimeline component for event history
- FermentationCurve component for SG visualization
- BatchEventForm components for measurements/additives

## Risk Assessment

### High Risk
- **Data migration complexity** - Existing vessel data needs proper batch assignment
- **Performance with large datasets** - Timeline queries with thousands of events

### Medium Risk
- **User adoption** - Operators must change workflows to use batch tracking
- **Integration complexity** - Coordinating with PressRun and PackagingRun systems

### Low Risk
- **UI complexity** - Standard CRUD operations with visualization
- **Security concerns** - Leveraging existing RBAC system

## Implementation Phases

### Phase 1: Core Infrastructure (Weeks 1-2)
- Database schema implementation
- Basic batch creation on PressRun completion
- Batch event logging API

### Phase 2: User Interface (Weeks 3-4)
- Batch Details tab implementation
- Event timeline display
- Basic measurement recording

### Phase 3: Advanced Features (Weeks 5-6)
- Fermentation curve visualization
- Transfer operations
- Batch closure via packaging

### Phase 4: Testing & Rollout (Weeks 7-8)
- Production data testing
- User training
- Gradual feature rollout

## Acceptance Criteria

### Definition of Done
- ✅ PressRun completion automatically creates Batch
- ✅ All vessel operations create BatchEvents
- ✅ Transfers update batch.vesselId without closing batch
- ✅ PackagingRun closes batch with status: packaged and endDate
- ✅ /cellar Batch Details tab shows timeline and fermentation curve
- ✅ AuditLog entries created for all batch operations
- ✅ RBAC permissions enforced for batch operations
- ✅ Performance targets met for query response times
- ✅ 95% test coverage for batch-related code
- ✅ User acceptance testing completed with real operators

### Quality Gates
- All batch operations must be atomic and consistent
- No batch data loss during vessel transfers
- Fermentation curves must accurately reflect measurement data
- Security audit passed for batch access controls
- Performance benchmarks met under production load