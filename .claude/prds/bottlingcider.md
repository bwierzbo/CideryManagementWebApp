---
name: bottlingcider
description: Minimal bottling flow with /cellar modal action and redesigned /packaging page for complete run management
status: backlog
created: 2025-09-25T21:18:22Z
updated: 2025-09-25T21:32:00Z
---

# PRD: Bottling Flow — /cellar → /packaging

## Executive Summary

Implement a streamlined bottling workflow that allows operators to bottle directly from vessels via a minimal modal on `/cellar`, recording essential data (volume taken, package size, units, loss), automatically transferring liquid out of vessels, and carrying batch identity into finished-goods inventory. The solution maintains simplicity on `/cellar` while offering comprehensive run management on a redesigned `/packaging` page.

## Problem Statement

Operators need a quick, efficient way to record bottling operations directly from the cellar view without navigating away from their primary workflow. Currently, there's no integrated path from active fermentation vessels to packaged finished goods, creating gaps in traceability and requiring manual tracking of packaging runs.

**Why This Matters:**
- Operators work primarily from `/cellar` and need quick bottling actions
- No current connection between vessel volumes and packaging operations
- Lack of automated vessel status updates after bottling
- Missing traceability from batch to finished goods
- Compliance requires complete packaging run records

## User Stories

### Story 1: Quick Bottling from Cellar (Operator)
**As an** operator on `/cellar`
**I want to** click "Bottle" on a vessel with an active batch
**So that I can** quickly record packaging without leaving my workflow

**Acceptance Criteria:**
- "Bottle" action visible only on vessels with active batches
- Modal captures: Volume taken (L), Package size, Units produced
- System auto-calculates loss: `volumeTaken - (units × unitSize)`
- On complete:
  - Creates PackagingRun tied to Batch
  - Decrements vessel volume by taken liters
  - If volume ~0, sets Vessel status to "Cleaning"
  - Offers redirect to `/packaging?runId=...`

### Story 2: Complete Run Management (Manager)
**As a** manager
**I want to** open `/packaging` to view the full run
**So that I can** edit QA fields, view details, and export compliance records

**Acceptance Criteria:**
- View complete run details including source batch/vessel
- Edit optional QA fields (fill checks, ABV measurements)
- Export records as PDF/CSV
- View traceability from ingredients through packaging

## Functional Requirements

### A. /cellar Modal Action

#### Entry Point
- **Location:** Vessel card on `/cellar` page
- **Button:** "Bottle" (enabled only if vessel has active batch)
- **Style:** Consistent with existing "Add Measurement" / "Add Additive" actions

#### Modal Fields
All fields required unless noted:

1. **Volume taken (L)**
   - Type: Numeric input
   - Validation: > 0, ≤ vessel.currentVolumeL
   - Help text: "Liters removed from vessel"

2. **Package size**
   - Type: Select dropdown
   - Options:
     - 355 ml (12 oz can/bottle)
     - 473 ml (16 oz can)
     - 500 ml bottle
     - 750 ml bottle
     - 1 L bottle
     - 19.5 L keg (1/6 barrel)
     - 30 L keg
     - 50 L keg

3. **Units produced**
   - Type: Integer input
   - Validation: ≥ 0

4. **Computed loss (L)**
   - Type: Read-only display
   - Formula: `volumeTaken - (units × unitSizeL)`
   - Styling: Warning if > 5% of volume taken

5. **Date/time**
   - Type: DateTime picker
   - Default: Current timestamp

#### Modal Actions
- **Primary:** "Complete & Go to /packaging" → Saves and redirects
- **Secondary:** "Complete & Stay" → Saves and shows success with "View run" link

#### Server Actions on Submit
```typescript
// Atomic transaction:
1. Create PackagingRun (status='completed', linked to batchId + vesselId)
2. Create InventoryItem with generated lotCode
3. Create InventoryMovement (reason='packaging', refId=runId)
4. Update vessel.currentVolumeL -= volumeTaken
5. If vessel.currentVolumeL ≤ 0.1L → vessel.status = 'Cleaning'
6. If batch total volume ~0 → batch.status = 'packaged'
7. Write AuditLog entries for all changes
```

### B. /packaging Page (Full Redesign Allowed)

#### Landing Behavior
- If `?runId=...` param → Show specific run view
- Otherwise → Show index of all packaging runs

#### Run View Components

1. **Header Section**
   - Batch name & ID
   - Source vessel
   - Packaging date
   - Run status
   - Edit button (Admin only)

2. **Production Card**
   - Package type & size
   - Units produced
   - Volume taken
   - Calculated loss (with percentage)
   - ABV at packaging (optional)
   - Carbonation level (still/petillant/sparkling)

3. **Traceability Card**
   - Batch ID & lot code
   - Full genealogy: Press Run → Juice Lot → Batch → Package
   - Lot code format: `BATCHCODE-YYMMDD-P{seq}`
   - QR code for lot tracking

4. **QA/Compliance Section** (Optional but visible)
   - Fill check: Pass/Fail toggle
   - Alcohol test result: ABV value
   - Test method: Select (hydrometer/refractometer/lab)
   - Notes: Text area
   - Editable by Admin/Operator roles

5. **Export Actions**
   - PDF: Formatted packaging run report
   - CSV: Data export for analysis
   - Archive: Mark for compliance retention

#### Run Index View
- Table/list of all packaging runs
- Columns: Date, Batch, Package Type, Units, Status
- Filters: Date range, Batch, Package type
- Sort: Date (default desc), Batch name, Units

## Data Model

### New Tables

```sql
-- PackagingRun: Core packaging operation record
CREATE TABLE packaging_runs (
  id UUID PRIMARY KEY,
  batch_id UUID REFERENCES batches(id),
  vessel_id UUID REFERENCES vessels(id),
  packaged_at TIMESTAMP NOT NULL,
  package_type VARCHAR(50) NOT NULL,
  unit_size_l DECIMAL(10,4) NOT NULL,
  units INTEGER NOT NULL,
  volume_taken_l DECIMAL(10,2) NOT NULL,
  loss_l DECIMAL(10,2) NOT NULL,
  abv_at_packaging DECIMAL(5,2),
  carbonation VARCHAR(20), -- 'still' | 'petillant' | 'sparkling'
  fill_check BOOLEAN,
  fill_check_notes TEXT,
  status VARCHAR(20) DEFAULT 'completed',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Extend existing InventoryItem for finished goods
ALTER TABLE inventory_items ADD COLUMN
  batch_id UUID REFERENCES batches(id),
  lot_code VARCHAR(100),
  packaging_run_id UUID REFERENCES packaging_runs(id);
```

### Lot Code Generation
Format: `BATCHCODE-YYMMDD-P{seq}`
- BATCHCODE: First 8 chars of batch.id or batch.name
- YYMMDD: Packaging date
- P{seq}: Sequential number for same batch/date

## API Endpoints (tRPC)

### Minimal New Surface

```typescript
// packaging router
packaging.createFromCellar({
  batchId: string,
  vesselId: string,
  packagedAt: Date,
  unitSizeL: number,
  units: number,
  volumeTakenL: number
}) → {
  runId: string,
  lossL: number,
  vesselStatus: string,
  inventoryItemId: string
}

packaging.get(runId: string) → PackagingRun & {
  batch: Batch,
  vessel: Vessel,
  inventory: InventoryItem[]
}

packaging.list({
  dateFrom?: Date,
  dateTo?: Date,
  batchId?: string
}) → PackagingRun[]

packaging.updateQA(runId: string, {
  fillCheck?: boolean,
  abvAtPackaging?: number,
  notes?: string
}) → PackagingRun
```

### Guards & Validation
- No overdraw: `volumeTaken ≤ vessel.currentVolumeL`
- Loss non-negative: `loss ≥ 0`
- High loss warning: `loss > volumeTaken × 0.05`
- Idempotency: Same payload doesn't duplicate runs

## Business Rules

### Core Invariants
1. **Loss Calculation:** `lossL = volumeTakenL - (unitSizeL × units)`, must be ≥ 0
2. **Volume Guard:** `volumeTakenL ≤ vessel.currentVolumeL` (checked at commit time)
3. **Vessel Cleaning:** If `vessel.currentVolumeL - volumeTakenL ≤ 0.1L` → `vessel.status = 'Cleaning'`
4. **Batch Completion:** If total batch volume across all vessels ≤ 0.1L → `batch.status = 'packaged'`
5. **Traceability:** All finished goods inherit `batchId` for genealogy/recall

### Compliance & Retention
- Packaging run records retained minimum 3 years
- ABV test results stored with method and date
- Fill check results logged for quality tracking
- Audit trail for all modifications

## Non-Functional Requirements

### Performance
- Modal load time < 500ms
- Packaging run creation < 2 seconds
- Support 100+ units per run
- /packaging page load < 1 second

### Mobile Support
- Modal fully functional on tablets
- /packaging page responsive design
- Touch-optimized inputs
- No horizontal scroll required

### Security
- Role-based access:
  - Operators: Create runs, edit own runs
  - Admins: Edit all runs, delete (void) runs
  - Viewers: Read-only access
- Audit logging for all changes
- No hard deletes (soft delete with reason)

## Implementation Plan

### Phase 1: MVP (Week 1-2)
- [ ] Add "Bottle" button to vessel cards
- [ ] Implement bottling modal with core fields
- [ ] Create PackagingRun table and API
- [ ] Basic /packaging page with run view
- [ ] Inventory item creation with lot codes

### Phase 2: Enhancement (Week 3)
- [ ] QA fields and compliance sections
- [ ] Export functionality (PDF/CSV)
- [ ] /packaging index with filters
- [ ] Batch genealogy display
- [ ] Mobile optimization

### Phase 3: Polish (Week 4)
- [ ] Loss warnings and confirmations
- [ ] Lot code QR generation
- [ ] Audit trail viewer
- [ ] Performance optimization
- [ ] Documentation and training

## Success Metrics

### Immediate (Day 1)
- Operators can bottle from /cellar in < 30 seconds
- Zero navigation errors or data loss
- Vessel volumes update correctly

### Week 1
- 90% of bottling operations use new flow
- < 5% error rate on submissions
- Positive operator feedback

### Month 1
- 50% reduction in packaging data entry time
- 100% traceability for all packaged goods
- Zero compliance violations from missing data

## Out of Scope

### Not in MVP
- Multi-vessel bottling in single run
- Packaging material inventory tracking
- Label printing integration
- Bottle conditioning tracking
- Labor hour tracking
- Cost per unit calculations

### Future Considerations
- Pack/case grouping (6-packs, 12-packs)
- Contract packaging workflows
- Returns/breakage tracking
- Direct sales integration
- Distributor allocations

## Risk Mitigation

### Identified Risks

1. **Concurrent Bottling**
   - Risk: Two operators bottle same vessel
   - Mitigation: Pessimistic locking on vessel during operation

2. **Data Loss**
   - Risk: Modal close loses entered data
   - Mitigation: Confirm dialog on close with unsaved changes

3. **Calculation Errors**
   - Risk: Incorrect loss or volume calculations
   - Mitigation: Server-side validation and recalculation

## QA Test Scenarios

### Critical Path Tests
1. Bottle from vessel with exact volume → Vessel goes to Cleaning
2. Bottle partial volume → Vessel remains active with correct volume
3. High loss warning appears at > 5%
4. Cannot overdraw vessel volume
5. Lot codes are unique and traceable
6. Audit log captures all changes

### Edge Cases
- Bottle 0 units (loss = full volume)
- Multiple simultaneous bottling attempts
- Network failure during submission
- Invalid package size selection
- DateTime in future/past

## Appendix

### Package Size Reference
```
355 ml = 12 fl oz (standard can/bottle)
473 ml = 16 fl oz (tall can)
500 ml = 16.9 fl oz (Euro bottle)
750 ml = 25.4 fl oz (wine bottle)
1000 ml = 33.8 fl oz (liter bottle)
19.5 L = 5.15 gal (1/6 barrel keg)
30 L = 7.93 gal (1/4 barrel)
50 L = 13.2 gal (1/2 barrel)
```

### Compliance References
- TTB Requirements: 27 CFR 24.255 (packaging records)
- FDA FSMA: 21 CFR 117 (preventive controls)
- State ABC: Packaging run documentation requirements