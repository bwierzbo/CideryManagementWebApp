---
name: purchasingpage
description: Flexible purchasing page redesign supporting free apples, optional weight/cost, bushel units, harvest dates, and auto-generated invoice numbers
status: backlog
created: 2025-09-14T00:50:17Z
---

# PRD: Flexible Apple Purchasing Workflow

## Vision / Problem

The current purchasing workflow doesn't reflect how apples are actually acquired: sometimes they are free, sometimes estimated by weight, sometimes in bushels. Operators are slowed down by required invoice numbers and unclear line item structure. We need a more natural, flexible entry process that still enforces backend consistency and integrates with reporting.

## Executive Summary

Redesign the purchasing page and schema to support real-world apple acquisition patterns: free apples, optional weight/cost tracking, bushel units, harvest date recording, and automatic invoice number generation. This will streamline data entry for operators while maintaining data integrity for COGS reporting and vendor management.

## Problem Statement

### Current Pain Points
The existing purchasing page enforces a rigid commercial transaction model that doesn't match actual apple acquisition:

1. **Inflexible Data Entry:** Required invoice numbers and costs don't accommodate free apples or estimated weights
2. **Poor Unit Support:** No bushel unit support despite common usage in apple procurement
3. **Generic Line Items:** "Line items" terminology doesn't reflect apple variety-focused workflow
4. **Missing Harvest Context:** No harvest date tracking for seasonal quality and timing analysis
5. **Manual Invoice Management:** User-entered invoice numbers create inconsistency and data entry burden
6. **Rigid Cost Requirements:** Cannot record free apple donations or weight-estimated purchases

### Business Impact
- **Data Entry Friction:** Operators spend extra time working around required fields for free/estimated apples
- **Inconsistent Records:** Manual invoice numbering leads to duplicates and missing data
- **Lost Context:** No harvest date tracking reduces traceability and seasonal analysis capability
- **Unit Conversion Errors:** Manual bushel-to-weight conversion introduces calculation mistakes

## Users / Stakeholders

**Operators (Primary)**
- Record apple purchases quickly, whether free, by weight, or by bushel
- Focus on apple variety management rather than complex invoicing
- Need mobile-friendly interface for field/warehouse use

**Admins (Secondary)**
- Get consistent records for COGS and vendor reporting
- Maintain data integrity while accommodating flexible input
- Generate reports with accurate unit conversions and cost allocation

**Developers (Supporting)**
- Maintain schema integrity while adapting forms and defaults
- Ensure COGS calculations work with optional fields and new units
- Preserve audit trail functionality with schema changes

## Key User Stories

### Story 1: Free Apple Recording
**As an** Operator
**I want** to record free apple donations without entering fake costs or invoice numbers
**So that** I can accurately track all apple sources for production planning

**Current Pain Points:**
- Required cost fields force entry of $0.00 or fake values
- Invoice number requirement creates artificial data
- Cannot distinguish between free apples and zero-cost purchases

### Story 2: Bushel-Based Entry
**As an** Operator
**I want** to enter apple quantities in bushels when that's how they're measured
**So that** I don't have to manually convert bushels to pounds/kilograms

**Current Pain Points:**
- Only kg/lb units supported despite bushel prevalence
- Manual conversion introduces calculation errors
- Loss of original measurement context

### Story 3: Harvest Date Tracking
**As an** Operator
**I want** to record when apples were harvested (separate from purchase date)
**So that** we can track apple freshness and seasonal quality patterns

**Current Pain Points:**
- No harvest date field - only purchase/invoice date
- Cannot correlate quality issues with harvest timing
- Missing traceability for seasonal analysis

### Story 4: Apple Variety Focus
**As an** Operator
**I want** the interface to focus on "apple varieties" rather than generic "line items"
**So that** the workflow matches how I think about apple purchasing

**Current Pain Points:**
- Generic "line items" terminology doesn't match mental model
- Interface designed for general products, not apple-specific workflow
- Mobile view needs clearer variety-focused actions

## Core Focus & Key Components

### 1. Optional Weight & Cost
**Requirement:** Allow creating purchase records with free apples (no cost)
- Make weight and cost optional fields in forms and database
- Support estimated weight entries when exact measurements unavailable
- Distinguish between free apples, donated apples, and zero-cost purchases
- COGS calculations must handle null/zero cost values gracefully

### 2. Apple Variety Line Items
**Requirement:** Rename "line items" → "apple varieties" throughout interface
- Update all UI text from "line items" to "apple varieties"
- In mobile view: "Add Apple Variety" button under variety input instead of generic "Add line"
- Form labels and help text should reflect apple-specific workflow
- Maintain same underlying data structure with improved UX terminology

### 3. Invoice Number Handling
**Requirement:** Invoice number no longer input by user
- Auto-generate invoice numbers: `YYYYMMDD-<vendorId>-<seq>` format
- Ensure uniqueness per vendor per day (sequential numbering)
- Invoice number stored in backend but hidden from UI forms
- Harvest Date input replaces invoice number field on purchase form
- Existing invoice numbers preserved in database for historical records

### 4. Harvest Date Support
**Requirement:** Capture harvest date separate from purchase date
- Top-level harvest date input applies to all apple varieties by default
- Each variety row has individual harvest date field (auto-populated, user-editable)
- Harvest date can be different from purchase date for storage/timing scenarios
- Support seasonal analysis and quality tracking based on harvest timing

### 5. Bushels as Unit
**Requirement:** Add "bushels" as a mass unit option
- Add "bushels" option to unit dropdown alongside kg/lb
- Conversion rate: 1 bushel = 40 lb = 18.14 kg (stored in backend)
- Store both input value (bushel count) and canonical weight (kg) in database
- Display original units in UI while using kg for calculations and COGS

### 6. Backend / Database Adjustments
**Requirement:** Update schema to support new features while preserving existing data
- Update purchases/purchase_lines tables to support:
  - `unit = 'bushel'` option
  - Optional weightKg and unitCost fields (nullable)
  - harvestDate field per variety
  - Auto-generated invoiceNumber field
- Create Drizzle migrations that preserve existing data
- Update COGS allocation logic to handle bushel → kg conversion
- Maintain audit logging for all schema changes

## Success Criteria

**Primary Success Metrics:**
- **Data Entry Speed:** Operators can record free apples (no cost, no weight) in under 2 minutes
- **Unit Flexibility:** Support apple quantities entered in lb, kg, or bushels with automatic conversion
- **Harvest Tracking:** 100% of purchases include harvest date for seasonal quality analysis
- **Invoice Consistency:** Auto-generated invoice numbers eliminate duplicate/missing invoice data
- **Workflow Clarity:** Apple variety terminology reduces operator confusion and training time

**Acceptance Criteria:**
- Operators can record:
  - Free apples (no cost, no weight)
  - Estimated weight apples (lb, kg, or bushels)
- Apple varieties replace generic line items in all views
- Harvest date is captured globally and per variety
- Invoice number generated automatically, unique per vendor/day, and hidden from form
- Reports and COGS calculations work correctly with new units and optional fields
- Audit logs track all changes as before
- Golden path (purchase → press run → batch → packaging → report) remains functional

## Non-Functional Requirements

### Data Integrity Requirements
- COGS calculations must handle optional weight/cost values without errors
- Unit conversions (bushel → kg) must be mathematically accurate and auditable
- Schema migrations must preserve all existing purchase data
- Auto-generated invoice numbers must be guaranteed unique per vendor/day

### Usability Requirements
- Mobile-responsive design optimized for field/warehouse tablet use
- Apple variety-focused terminology throughout interface
- Harvest date input with calendar picker and date validation
- Clear visual distinction between estimated and exact weight entries

### Integration Requirements
- Compatible with existing tRPC v11 API structure
- Maintains integration with pressing workflow and COGS calculations
- Preserves audit logging functionality with schema changes
- Backwards compatible with existing purchase data structure

## Out of Scope

**Features Explicitly Excluded:**
- **Multi-vendor invoices:** Single vendor per purchase record maintained
- **Price negotiation or contracts:** Vendor relationship management beyond basic contact info
- **Bulk CSV purchase imports:** Manual entry workflow focus
- **Advanced analytics:** Historical trends, predictive analytics, vendor performance scoring
- **Purchase order approval workflow:** Direct purchase recording without approval gates
- **Quality inspection integration:** Basic purchase recording without quality management

**Future Phase Considerations:**
- Advanced vendor performance analytics and scorecards
- Purchase order planning and approval workflows
- Quality management integration with receiving inspection
- Seasonal planning and harvest calendar management
- Cost optimization analytics and reporting

## Implementation Roadmap

### Phase 1: Core Flexibility (Weeks 1-4)
**Schema & Backend:**
- Update purchases/purchase_lines tables with nullable weight/cost fields
- Add bushel unit support with conversion logic (1 bushel = 18.14 kg)
- Add harvestDate field to purchase_lines table
- Implement auto-generated invoice number system (YYYYMMDD-vendorId-seq)
- Create Drizzle migrations preserving existing data

**Frontend Updates:**
- Replace "line items" terminology with "apple varieties" throughout UI
- Add harvest date input fields (global and per-variety)
- Remove invoice number input field from forms
- Add bushel option to unit dropdown
- Update form validation for optional weight/cost fields

### Phase 2: UX Enhancement (Weeks 5-6)
**Mobile Optimization:**
- "Add Apple Variety" button positioning in mobile view
- Improved mobile layout for variety-focused workflow
- Touch-friendly harvest date picker
- Visual indicators for estimated vs. exact weight entries

**Testing & Validation:**
- Comprehensive testing of unit conversion accuracy
- COGS calculation validation with optional fields
- Golden path testing (purchase → pressing → batch → reporting)
- Migration testing with existing purchase data

### Acceptance / Deliverables

**Updated UI Components:**
- Purchasing page with apple variety terminology
- Harvest date inputs (global and per-variety)
- Bushel unit support with automatic kg conversion
- Optional weight/cost field handling
- Mobile-optimized variety management interface

**Backend Implementation:**
- Schema migrations for purchases/purchase_lines tables
- Auto invoice number generation service
- Unit conversion logic (bushel ↔ kg)
- Updated COGS calculation handling optional fields
- Preserved audit logging functionality

**Verification Requirements:**
- Free apples can be recorded without cost/weight
- Estimated weight entries work in lb, kg, and bushels
- Harvest dates captured globally and per variety
- Invoice numbers auto-generated, unique per vendor/day
- Golden path functionality maintained (purchase → press → batch → package → report)
- All existing purchase data preserved and functional

**Timeline:** 6 weeks total
- **Weeks 1-4:** Core schema and backend implementation
- **Weeks 5-6:** Frontend UX improvements and comprehensive testing