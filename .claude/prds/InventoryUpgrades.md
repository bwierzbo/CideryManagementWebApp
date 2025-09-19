---
name: InventoryUpgrades
description: Unified transaction recording system with comprehensive inventory tracking for all material types
status: backlog
created: 2025-09-19T14:55:55Z
---

# PRD: InventoryUpgrades

## Executive Summary

Transform the current apple-only purchasing system into a comprehensive inventory management solution that handles all material types (apples, additives, juice, packaging) through a unified transaction recording interface. This upgrade will provide complete visibility into all inventory movements with advanced sorting, filtering, and search capabilities.

## Problem Statement

The current system only tracks apple purchases, leaving significant gaps in inventory visibility for other critical materials like additives, juice purchases, and packaging supplies. Users lack a unified way to record different types of inventory transactions and cannot easily view or analyze their complete inventory position across all material categories. This fragmented approach leads to:

- Incomplete cost tracking and COGS calculations
- Manual tracking of non-apple materials outside the system
- Difficulty in maintaining accurate inventory levels
- Inability to forecast material needs effectively
- Risk of stockouts or over-ordering

## User Stories

### Primary Personas

**1. Inventory Manager (Sarah)**
- Needs to record all types of inventory transactions quickly
- Wants visibility into current stock levels across all materials
- Requires ability to track vendor relationships for all material types
- Must maintain accurate records for TTB compliance

**2. Production Manager (Mike)**
- Needs to check material availability before planning production runs
- Wants to track consumption of additives and packaging
- Requires visibility into juice inventory for blending operations
- Must ensure adequate packaging supplies for bottling runs

**3. Finance Manager (Lisa)**
- Needs complete inventory valuation for financial reporting
- Wants accurate COGS tracking across all material types
- Requires audit trails for all inventory movements
- Must reconcile physical counts with system records

### User Journeys

**Recording a Transaction:**
1. User clicks "Record Transaction" button on inventory page
2. System presents transaction type selector (Apples/Additives/Juice/Packaging)
3. User selects type and sees appropriate form
4. User completes form with vendor, items, quantities, and costs
5. System saves transaction and updates inventory levels
6. User sees confirmation and updated inventory table

**Viewing Inventory:**
1. User navigates to inventory page
2. Sees comprehensive table with all inventory items
3. Can filter by type (apples, additives, juice, packaging)
4. Can search for specific items
5. Can sort by any column (name, type, quantity, value, date)
6. Can export data for reporting

## Requirements

### Functional Requirements

**Transaction Recording System:**
- Unified "Record Transaction" button replacing current "New Purchase" form
- Transaction type selector with four options: Apples, Additives, Juice, Packaging
- Dynamic form rendering based on selected transaction type
- Support for multiple line items per transaction
- Vendor management for all material types

**Form Specifications:**

*Apples Form (existing):*
- Maintain current functionality with vendor selection
- Apple variety management
- Quantity, unit, and pricing
- Harvest date tracking

*Additives Form:*
- Additive type selection (yeast, nutrients, acids, enzymes, etc.)
- Brand/manufacturer field
- Quantity and unit of measure (g, kg, oz, lb)
- Lot/batch number tracking
- Expiration date field
- Storage requirements notes

*Juice Form:*
- Juice type (apple, pear, other)
- Source/vendor selection
- Volume and unit (gallons, liters)
- Brix/sugar content
- pH level
- Processing date
- Tank/container assignment

*Packaging Form:*
- Package type (bottles, cans, kegs, cases, caps, labels)
- Size/specification details
- Quantity per unit (e.g., cases of 12)
- SKU/product code
- Lead time information
- Minimum order quantity tracking

**Inventory Table:**
- Display all inventory items in unified table
- Columns: Item Name, Type, Category, Current Quantity, Unit, Location, Value, Last Updated
- Type-based visual indicators (icons/colors)
- Real-time search across all fields
- Multi-column sorting capability
- Quick filters for material type
- Pagination for large datasets
- Row selection for bulk operations

**Search & Filter Capabilities:**
- Global search box with instant results
- Type filter buttons (All, Apples, Additives, Juice, Packaging)
- Advanced filters: date range, vendor, location, stock level
- Save filter combinations as views
- Clear all filters option

### Non-Functional Requirements

**Performance:**
- Table should load within 2 seconds for up to 10,000 items
- Search results appear within 300ms of typing
- Form submission completes within 1 second
- Sorting operations complete within 500ms

**Usability:**
- Mobile-responsive design for warehouse use
- Intuitive navigation between transaction types
- Auto-save draft transactions
- Keyboard shortcuts for common actions
- Inline editing for quick quantity adjustments

**Data Integrity:**
- Transaction atomicity (all-or-nothing saves)
- Validation rules for each material type
- Duplicate detection for similar items
- Audit log for all changes
- Data backup before bulk operations

**Security:**
- Role-based access control
- Admin: Full access to all functions
- Operator: Can record transactions and view inventory
- Viewer: Read-only access to inventory data

## Success Criteria

**Quantitative Metrics:**
- 100% of inventory transactions recorded in system (vs current ~25%)
- 50% reduction in time to record non-apple transactions
- 90% user satisfaction with new interface (survey)
- 75% reduction in inventory discrepancies
- 30% improvement in inventory turnover ratio

**Qualitative Metrics:**
- Users prefer new unified interface over separate forms
- Improved confidence in inventory accuracy
- Better visibility leads to improved purchasing decisions
- Simplified training for new employees
- Enhanced compliance reporting capabilities

## Constraints & Assumptions

### Technical Constraints
- Must integrate with existing tRPC API architecture
- Maintain compatibility with current database schema
- Work within Next.js 15 and React framework
- Use existing shadcn/ui component library

### Business Constraints
- Must maintain backward compatibility with existing apple purchase data
- Cannot disrupt current production operations during rollout
- Must complete within current budget allocation
- Limited to 2-developer team for implementation

### Assumptions
- Users have basic computer literacy
- Vendors for all material types can be managed similarly
- Current authentication/authorization system is sufficient
- Existing backup and recovery procedures are adequate

## Out of Scope

The following items are explicitly NOT included in this phase:
- Barcode/QR code scanning integration
- Automated reorder point calculations
- Integration with external POS systems
- Predictive analytics or forecasting
- Multi-warehouse management
- Consignment inventory tracking
- Manufacturing resource planning (MRP)
- API for third-party integrations
- Mobile native applications
- Real-time synchronization with accounting software

## Dependencies

**Internal Dependencies:**
- Current vendor management system must be extended
- Database schema updates for new material types
- Authentication system for role-based access
- Existing purchase order workflow for apples

**External Dependencies:**
- No external system dependencies for Phase 1

**Data Dependencies:**
- Migration strategy for existing apple purchase data
- Initial data load for additives catalog
- Packaging specifications from suppliers
- Juice vendor information

## Implementation Phases

**Phase 1: Foundation (Week 1-2)**
- Database schema updates for new material types
- API endpoints for transaction recording
- Basic form infrastructure

**Phase 2: Transaction Forms (Week 3-4)**
- Implement additives transaction form
- Implement juice transaction form
- Implement packaging transaction form
- Form validation and error handling

**Phase 3: Inventory Table (Week 5-6)**
- Unified inventory table component
- Sorting and pagination
- Search functionality
- Type filtering

**Phase 4: Polish & Testing (Week 7-8)**
- UI/UX refinements
- Performance optimization
- User acceptance testing
- Documentation and training materials

## Risks & Mitigation

**Risk 1: Data Migration Complexity**
- Impact: High
- Probability: Medium
- Mitigation: Create comprehensive backup strategy, implement gradual rollout

**Risk 2: User Adoption Resistance**
- Impact: Medium
- Probability: Low
- Mitigation: Involve users in design process, provide thorough training

**Risk 3: Performance Issues with Large Datasets**
- Impact: Medium
- Probability: Medium
- Mitigation: Implement pagination early, optimize database queries, add caching layer

## Future Enhancements

Potential features for subsequent phases:
- Barcode scanning for rapid inventory entry
- Automated low-stock alerts
- Vendor performance analytics
- Inventory forecasting based on production schedules
- Integration with accounting systems
- Mobile app for warehouse operations
- Batch tracking and traceability
- Inventory valuation methods (FIFO/LIFO)
- Multi-location inventory transfers
- Purchase order automation