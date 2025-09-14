---
name: applepress
description: Mobile-first apple pressing workflow with stepwise fruit loading, inventory reconciliation, and vessel assignment
status: backlog
created: 2025-09-14T05:30:59Z
---

# PRD: ApplePress

## Executive Summary

ApplePress is a mobile-first pressing workflow that enables operators to easily record apple pressing runs with stepwise fruit loading. The system enforces schema ties between purchased apples and pressing operations to ensure accurate yield tracking and COGS reconciliation. The solution addresses the current workflow rigidity by providing a simplified, resumable process that defaults to pounds for weight entry while maintaining strict inventory controls through purchase line integration.

## Problem Statement

**What problem are we solving?**
Current pressing workflows are too rigid and allow inconsistent data entry (free-typed varieties, complex unit systems) that makes COGS reconciliation difficult. Operators need a simple mobile interface to record pressing runs that automatically ties back to purchased inventory while supporting interruption and resumption of data entry.

**Why is this important now?**
- Operators struggle with complex workflows on mobile devices
- Fruit usage reconciliation with purchasing data is manual and error-prone
- COGS calculations require accurate traceability from purchases to juice production
- Current system allows data inconsistencies that impact financial reporting

## User Stories

### Primary User Personas

**Production Operator (Mobile User)**
- Needs to quickly log pressing runs during busy harvest season
- Works in production environment with potentially dirty/wet hands
- May be interrupted during data entry and need to resume later
- Requires large touch targets and simple navigation

**Production Manager/Admin (Desktop User)**
- Needs to reconcile pressed fruit against purchase orders
- Monitors yield efficiency across different apple varieties
- Tracks COGS accuracy for financial reporting
- Reviews labor costs associated with pressing operations

### User Journeys

**Journey 1: Complete Press Run (Happy Path)**
1. Operator starts new press run, selects vendor
2. For each fruit load:
   - Selects apple variety from purchased inventory
   - Enters weight in pounds (default) or kilograms
   - System saves immediately
   - Chooses "Add another load" or "Finish"
3. At completion:
   - Enters total juice volume
   - Assigns juice to destination vessel
   - Optionally logs labor hours/workers
   - Marks run as completed

**Journey 2: Interrupted Press Run (Resume Path)**
1. Operator starts press run, adds several fruit loads
2. Gets interrupted (phone call, equipment issue, etc.)
3. Later returns to system
4. Resumes existing press run from where left off
5. Continues adding loads or proceeds to finish

**Journey 3: Admin Reconciliation**
1. Admin views completed press runs
2. Reviews fruit usage against purchase line inventory
3. Analyzes yield ratios by variety
4. Validates COGS calculations

## Requirements

### Functional Requirements

**Core Features:**
- **Start Press Run:** Create new run linked to vendor with timestamp
- **Stepwise Fruit Loading:** Add multiple fruit loads one at a time with immediate save
- **Weight Entry:** Support pounds (default) and kilograms with clear unit toggle
- **Inventory Integration:** Restrict apple variety selection to available purchase lines
- **Resume Capability:** Allow operators to pause and resume press runs
- **Juice Volume Recording:** Capture final juice output with vessel assignment
- **Labor Tracking:** Optional hours and worker count for COGS calculation
- **Mobile-First UI:** Large touch targets, single-load-per-screen design

**Data Management:**
- Immediate save after each fruit load entry
- Automatic unit conversion (lbs/kg) with canonical storage
- Juice volume in liters (canonical) with L/gal input options
- Audit logging for all press run activities
- Traceability from press runs back to purchase lines

**User Interface:**
- Mobile-optimized layout with large buttons
- Clear "Add Another Load" vs "Finish Run" actions
- Visual progress indicator for multi-load runs
- Simple variety dropdown restricted to purchased inventory
- Weight input with prominent unit selector (lbs default)

### Non-Functional Requirements

**Performance:**
- Sub-second save response for fruit load entries
- Offline-capable for interrupted connectivity
- Support for 50+ concurrent press runs during peak season

**Usability:**
- Single-handed mobile operation capability
- Large touch targets (minimum 44px)
- Clear visual feedback for saved entries
- Error prevention through UI constraints

**Data Integrity:**
- Fruit varieties must exist in purchase line inventory
- Weight entries validated as positive numbers
- Vessel assignment validated against available vessels
- Complete audit trail for all operations

**Security:**
- Role-based access (Operator vs Admin permissions)
- Secure API endpoints for press run operations
- Data validation on both client and server

## Success Criteria

### Measurable Outcomes
- **Operator Efficiency:** 75% reduction in time to record press runs
- **Data Accuracy:** 95% of press runs completed without data errors
- **Mobile Usage:** 90% of press runs created on mobile devices
- **Resume Rate:** 60% of interrupted runs successfully resumed
- **Inventory Reconciliation:** 100% of fruit usage traceable to purchase lines

### Key Metrics and KPIs
- Average time per press run entry
- Error rate in fruit variety selection
- Percentage of runs completed vs abandoned
- Yield variance between predicted and actual
- COGS calculation accuracy improvement

## Constraints & Assumptions

### Technical Limitations
- Must work on existing Next.js/tRPC/PostgreSQL stack
- Integration with existing purchase line schema required
- Mobile browser compatibility (iOS Safari, Android Chrome)

### Timeline Constraints
- MVP delivery needed before next harvest season
- Phased rollout with operator training required

### Resource Limitations
- Development team familiar with existing codebase
- Limited QA resources for mobile testing
- Production deployment windows during non-harvest periods

### Assumptions
- Operators have smartphones/tablets available
- Wi-Fi connectivity available in pressing areas
- Purchase line data is accurate and up-to-date
- Vessels are pre-configured in system

## Out of Scope

**Explicitly NOT Building:**
- Bushel measurements for pressing (purchasing only)
- Multi-vessel juice splitting from single run
- Predictive yield modeling or forecasting
- Equipment maintenance tracking
- Advanced reporting/analytics (future phase)
- Desktop-first UI (mobile-first only)
- Batch recipe integration
- Quality testing parameter entry

## Dependencies

### External Dependencies
- Existing purchase line schema with apple varieties
- Vessel management system for tank/barrel assignment
- Labor cost calculation system integration

### Internal Team Dependencies
- Backend team: tRPC API development and schema migrations
- Frontend team: Mobile-responsive React components
- QA team: Mobile device testing across platforms
- Product team: Operator training and rollout planning

### Technical Dependencies
- Database schema migrations for press run tables
- API security updates for new endpoints
- Existing audit logging system integration
- Purchase line inventory validation logic

## Technical Architecture

### Database Schema Extensions
```sql
-- Press runs table
press_runs (
  id, vendor_id, start_time, end_time,
  status, juice_volume_l, vessel_id,
  labor_hours, worker_count, notes
)

-- Press run fruit loads
press_run_loads (
  id, press_run_id, purchase_line_id,
  apple_variety_id, weight_kg, weight_unit_entered,
  created_at
)
```

### API Endpoints
- `POST /api/press-runs` - Create new press run
- `POST /api/press-runs/{id}/loads` - Add fruit load
- `PUT /api/press-runs/{id}/finish` - Complete press run
- `GET /api/press-runs/{id}` - Resume existing run
- `GET /api/purchase-lines/available` - Get pressable inventory

### Integration Points
- Purchase line inventory validation
- Vessel assignment validation
- Audit log creation for all operations
- COGS calculation hooks for labor and fruit costs

## Implementation Phases

### Phase 1: Core Press Run Management
- Basic press run creation and management
- Simple fruit load entry with immediate save
- Purchase line integration for variety selection

### Phase 2: Mobile Optimization & Resume
- Mobile-first UI implementation
- Resume capability for interrupted runs
- Enhanced touch interface design

### Phase 3: Juice & Vessel Management
- Juice volume recording with unit conversion
- Vessel assignment integration
- Press run completion workflow

### Phase 4: Labor & COGS Integration
- Optional labor hour tracking
- COGS calculation integration
- Admin reconciliation views

## Risks & Mitigations

### High Risk
- **Mobile connectivity issues:** Implement offline-first design with sync
- **Complex purchase line integration:** Start with simplified inventory model
- **Operator adoption resistance:** Extensive training and gradual rollout

### Medium Risk
- **Performance with large datasets:** Implement pagination and lazy loading
- **Data consistency across sessions:** Robust state management and validation

### Low Risk
- **Browser compatibility:** Target modern mobile browsers only
- **Unit conversion errors:** Comprehensive testing of conversion logic