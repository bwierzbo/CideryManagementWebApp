---
name: purchasingpage
status: completed
created: 2025-09-14T01:08:28Z
completed: 2025-09-14T02:28:35Z
progress: 100%
prd: .claude/prds/purchasingpage.md
github: [Will be updated when synced to GitHub]
---

# Epic: Flexible Apple Purchasing Workflow

## Overview

Redesign the purchasing page to support real-world apple acquisition patterns by making weight and cost optional, adding bushel unit support, implementing harvest date tracking, auto-generating invoice numbers, and updating terminology from "line items" to "apple varieties". This focuses on minimal schema changes while maximizing UX improvements for operators recording diverse apple acquisition scenarios.

## Architecture Decisions

### Database Strategy
- **Minimal Schema Impact:** Extend existing purchases/purchaseItems tables rather than restructuring
- **Nullable Fields:** Make weightKg and unitCost nullable to support free apples and estimated entries
- **Unit Extension:** Add 'bushel' to existing unit enum with conversion logic (1 bushel = 18.14 kg)
- **Auto-numbering:** Generate invoice numbers server-side using format: YYYYMMDD-{vendorId}-{seq}
- **Audit Preservation:** Maintain existing audit logging with new field changes

### Frontend Approach
- **Progressive Enhancement:** Update existing purchase form components rather than rebuilding
- **Terminology Swap:** Replace "line items" with "apple varieties" throughout UI text
- **Validation Updates:** Modify React Hook Form validation to handle optional weight/cost
- **Mobile Optimization:** Improve mobile layout with variety-focused button placement

### Data Consistency
- **COGS Integration:** Extend existing cost calculation logic to handle null values gracefully
- **Unit Conversion:** Implement bushel↔kg conversion at form submission and display layers
- **Migration Safety:** Ensure existing purchase data remains fully functional with new schema

## Technical Approach

### Frontend Components
**Existing Component Updates:**
- **PurchaseFormComponent:** Update form validation schema for optional weight/cost fields
- **Terminology Updates:** Replace all "line items" text with "apple varieties" in labels and buttons
- **Harvest Date Inputs:** Add date picker components for global and per-variety harvest dates
- **Unit Dropdown:** Extend existing unit selection to include "bushels" option
- **Mobile Layout:** Reposition "Add Apple Variety" button for better mobile UX

**New Components:**
- **HarvestDatePicker:** Reusable date input with validation for harvest dates
- **UnitConverter:** Display component showing bushel→kg conversion in real-time
- **OptionalFieldWrapper:** Form field wrapper indicating estimated vs. exact values

### Backend Services
**API Extensions (tRPC):**
- **purchase.create:** Update mutation to handle optional weight/cost and auto-generate invoice numbers
- **purchase.update:** Extend existing mutation with new field support
- **invoiceNumber.generate:** New service for generating unique invoice numbers per vendor/day
- **unitConversion.bushelsToKg:** Utility function for consistent unit conversion

**Database Schema:**
```sql
-- Extend existing purchaseItems table
ALTER TABLE purchase_items
  ALTER COLUMN weight_kg DROP NOT NULL,
  ALTER COLUMN unit_cost DROP NOT NULL,
  ADD COLUMN harvest_date DATE,
  ADD COLUMN original_unit VARCHAR(10),
  ADD COLUMN original_quantity DECIMAL(10,2);

-- Extend purchases table
ALTER TABLE purchases
  ADD COLUMN auto_generated_invoice BOOLEAN DEFAULT false;

-- Update unit enum
ALTER TYPE unit_type ADD VALUE 'bushel';
```

**Business Logic Updates:**
- **COGS Calculator:** Handle null weight/cost values in existing cost rollup functions
- **Unit Converter:** Implement bushel conversion (1 bushel = 18.14 kg) with precision handling
- **Invoice Generator:** Create unique daily sequence per vendor with format validation

### Infrastructure
**Migration Approach:**
- **Backwards Compatible:** All existing purchase data remains functional
- **Gradual Rollout:** New features optional, existing workflows unchanged
- **Data Integrity:** Foreign key relationships and audit trails preserved

**Validation Strategy:**
- **Form Level:** Optional field validation with clear UX indicators
- **API Level:** Server-side validation for unit conversions and invoice uniqueness
- **Database Level:** Constraints ensuring data consistency with nullable fields

## Implementation Strategy

### Development Phases
**Phase 1: Schema & Backend (2 weeks)**
- Create database migrations for nullable weight/cost fields
- Implement bushel unit support with conversion logic
- Add harvest date fields to purchase items
- Create auto-invoice number generation service
- Update COGS calculation to handle optional values

**Phase 2: Frontend Updates (2 weeks)**
- Update purchase form validation for optional fields
- Replace "line items" terminology with "apple varieties"
- Add harvest date input components (global + per-variety)
- Extend unit dropdown with bushel option and conversion display
- Implement mobile UX improvements for variety-focused workflow

**Phase 3: Testing & Refinement (2 weeks)**
- Comprehensive testing of unit conversion accuracy
- Validate COGS calculations with mixed free/paid purchases
- Test golden path functionality (purchase → pressing → batch → reporting)
- Mobile device testing on tablets/phones
- Migration testing with existing production data

### Risk Mitigation
**Data Migration Risks:** Thorough testing with production data copies before deployment
**COGS Calculation Errors:** Extensive unit testing of cost allocation with null values
**Invoice Number Conflicts:** Database constraints and testing for uniqueness guarantees
**User Adoption:** Gradual feature introduction with existing workflow preservation

### Testing Approach
- **Unit Tests:** All conversion logic, invoice generation, and COGS calculations
- **Integration Tests:** Full purchase workflow from form submission to database storage
- **End-to-End Tests:** Golden path testing (purchase → press → batch → package → report)
- **Mobile Testing:** Touch interface testing on actual tablet devices

## Task Breakdown Preview

High-level task categories that will be created:
- [ ] **Database Schema Extensions:** Add nullable weight/cost, harvest dates, bushel units, and auto-invoice fields
- [ ] **Invoice Number Auto-generation:** Implement unique daily sequence generation per vendor
- [ ] **Unit Conversion System:** Bushel↔kg conversion logic with precision handling
- [ ] **Purchase Form UX Updates:** Optional fields, apple variety terminology, mobile improvements
- [ ] **Harvest Date Integration:** Global and per-variety date input components
- [ ] **COGS Calculation Updates:** Handle optional weight/cost values in existing cost rollup logic
- [ ] **Database Migration Implementation:** Safe migration preserving existing purchase data
- [ ] **Comprehensive Testing Suite:** Unit conversion, COGS accuracy, golden path validation

## Dependencies

**External Dependencies:**
- **Existing Purchase Schema:** Current purchases/purchaseItems table structure must be preserved
- **COGS Framework:** Existing cost calculation system must accommodate nullable fields
- **Audit System:** Current audit logging must work with schema extensions

**Internal Dependencies:**
- **tRPC API Structure:** Must maintain compatibility with existing purchase endpoints
- **React Hook Form:** Current form validation approach needs extension for optional fields
- **Mobile Tablet Devices:** Testing requires access to actual warehouse tablet devices

**Development Dependencies:**
- **Drizzle Migrations:** Database schema change capability
- **Unit Test Framework:** Comprehensive testing of conversion and calculation logic
- **Form Validation Updates:** React Hook Form schema modifications for optional fields

## Success Criteria (Technical)

**Data Accuracy Requirements:**
- **Unit Conversion Precision:** Bushel→kg conversion accurate to 0.01 kg (±0.1% error tolerance)
- **Invoice Number Uniqueness:** 100% unique generation per vendor per day with proper sequence handling
- **COGS Calculation Integrity:** Cost rollup functions handle null values without errors or incorrect totals
- **Migration Data Preservation:** All existing purchase records remain fully functional post-migration

**Performance Benchmarks:**
- **Form Submission:** Purchase creation with optional fields completes within 2 seconds
- **Page Load:** Purchase page loads within 3 seconds with new components
- **Mobile Responsiveness:** Form usable on tablets with touch targets ≥44px

**Quality Gates:**
- **Test Coverage:** ≥95% coverage for unit conversion, invoice generation, and COGS calculation functions
- **Backwards Compatibility:** All existing purchase workflows continue to function identically
- **Data Integrity:** Zero data corruption during schema migration process

**Acceptance Criteria:**
- Operators can record free apples without entering fake cost/weight values
- Bushel quantities automatically convert to kg with displayed conversion factor
- Harvest dates captured globally and individually per apple variety
- Invoice numbers generated automatically and hidden from user input forms
- Mobile interface optimized for "Add Apple Variety" workflow
- Golden path (purchase → press → batch → package → report) remains fully functional

## Estimated Effort

**Overall Timeline:** 6 weeks
- **Phase 1 (Schema & Backend):** 2 weeks - Database migrations, auto-numbering, unit conversion
- **Phase 2 (Frontend Updates):** 2 weeks - Form updates, terminology changes, UX improvements
- **Phase 3 (Testing & Refinement):** 2 weeks - Comprehensive testing, mobile optimization, deployment

**Resource Requirements:**
- **1 Full-stack Developer:** Primary implementation across database, API, and frontend
- **0.25 QA Engineer:** Testing focus on data integrity, unit conversion accuracy, and mobile UX

**Critical Path Items:**
1. **Database Schema Migration:** Must be completed first, enables all other development
2. **Unit Conversion Logic:** Core mathematical accuracy required for COGS integrity
3. **COGS Calculation Updates:** Must handle nullable values before frontend deployment
4. **Mobile UX Testing:** Critical for operator adoption in field/warehouse environments

**Effort Distribution:**
- **Backend (40%):** Schema changes, API updates, business logic modifications
- **Frontend (35%):** Form updates, component modifications, terminology changes
- **Testing (25%):** Unit testing, integration testing, mobile device validation

The focused scope on UX improvements and minimal schema extensions makes this a low-risk, high-value enhancement that directly addresses operator pain points while preserving data integrity and existing functionality.

## Tasks Created
- [ ] 001.md - Database Schema Extensions (parallel: false)
- [ ] 002.md - Database Migration Implementation (parallel: false)
- [ ] 003.md - Unit Conversion System (parallel: true)
- [ ] 004.md - Invoice Number Auto-generation (parallel: true)
- [ ] 005.md - COGS Calculation Updates (parallel: true)
- [ ] 006.md - Purchase Form UX Updates (parallel: true)
- [ ] 007.md - Harvest Date Integration (parallel: true)
- [ ] 008.md - Comprehensive Testing Suite (parallel: false)

Total tasks: 8
Parallel tasks: 5 (003, 004, 005, 006, 007)
Sequential tasks: 3 (001, 002, 008)
Estimated total effort: 116 hours (~6 weeks with 1 developer)