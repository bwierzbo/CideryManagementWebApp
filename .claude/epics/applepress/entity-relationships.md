# ApplePress Entity Relationship Diagram

## Overview
This document provides a visual representation of how the new ApplePress tables (`press_runs` and `press_run_loads`) integrate with the existing domain model.

## Entity Relationship Diagram

```
                                    EXISTING DOMAIN
    ┌─────────────┐       ┌─────────────┐       ┌─────────────┐
    │   vendors   │       │    users    │       │   vessels   │
    │             │       │             │       │             │
    │ id (PK)     │       │ id (PK)     │       │ id (PK)     │
    │ name        │       │ email       │       │ name        │
    │ contact_info│       │ name        │       │ type        │
    │ is_active   │       │ role        │       │ capacity_l  │
    │ ...         │       │ ...         │       │ status      │
    └─────────────┘       └─────────────┘       └─────────────┘
           │                      │                      │
           │                      │                      │
           │           ┌──────────┼──────────┐           │
           │           │          │          │           │
           │           │          │          │           │
           │           ▼          ▼          ▼           │
           │    ┌─────────────────────────────────────────┼──┐
           │    │              NEW APPLEPRESS TABLES            │
           │    │                                               │
           │    │  ┌─────────────┐           created_by/        │
           │    │  │ press_runs  │◄─────── updated_by           │
           │    │  │             │                              │
           │    │  │ id (PK)     │                              │
           └────┼─►│ vendor_id   │                              │
                │  │ vessel_id   │◄─────────────────────────────┘
                │  │ status      │
                │  │ start_time  │
                │  │ end_time    │
                │  │ total_*     │
                │  │ labor_*     │
                │  │ created_*   │
                │  │ updated_*   │
                │  │ ...         │
                │  └─────────────┘
                │         │
                │         │ 1:N
                │         │
                │         ▼
                │  ┌─────────────┐
                │  │press_run_   │
                │  │loads        │
                │  │             │
                │  │ id (PK)     │
                │  │ press_run_id│ (FK, CASCADE)
                │  │ purchase_   │
                │  │  item_id    │────┐
                │  │ apple_      │    │
                │  │  variety_id │────┼─┐
                │  │ load_seq    │    │ │
                │  │ apple_wt_kg │    │ │
                │  │ juice_vol_l │    │ │
                │  │ brix_meas   │    │ │
                │  │ created_*   │    │ │
                │  │ updated_*   │    │ │
                │  │ ...         │    │ │
                │  └─────────────┘    │ │
                │                     │ │
                └─────────────────────┼─┼─────────────
                                      │ │
                      EXISTING DOMAIN │ │
                                      │ │
                ┌─────────────┐       │ │    ┌─────────────┐
                │ purchases   │       │ │    │apple_       │
                │             │       │ │    │varieties    │
                │ id (PK)     │       │ │    │             │
                │ vendor_id   │       │ │    │ id (PK)     │
                │ purchase_   │       │ │    │ name        │
                │  date       │       │ │    │ typical_brix│
                │ total_cost  │       │ │    │ ...         │
                │ ...         │       │ │    └─────────────┘
                └─────────────┘       │ │           ▲
                       │              │ │           │
                       │ 1:N          │ │           │
                       ▼              │ │           │
                ┌─────────────┐       │ │           │
                │purchase_    │       │ │           │
                │items        │       │ │           │
                │             │       │ │           │
                │ id (PK)     │◄──────┘ │           │
                │ purchase_id │         │           │
                │ apple_var_id│─────────┘           │
                │ quantity    │                     │
                │ unit        │                     │
                │ quantity_kg │                     │
                │ quantity_l  │                     │
                │ original_*  │                     │
                │ ...         │                     │
                └─────────────┘                     │
                       │                            │
                       └────────────────────────────┘
```

## Key Relationships

### 1. Press Runs → Core Entities
- **vendors**: `press_runs.vendor_id → vendors.id`
  - Organizes pressing by vendor for operational efficiency
  - Supports vendor-specific workflow and pricing

- **vessels**: `press_runs.vessel_id → vessels.id`
  - Assigns target vessel for juice collection
  - Integrates with existing vessel management

- **users**: `press_runs.created_by/updated_by → users.id`
  - Full RBAC integration for audit trail
  - Tracks who created/modified press runs

### 2. Press Run Loads → Traceability Chain
- **press_runs**: `press_run_loads.press_run_id → press_runs.id` (CASCADE)
  - Parent-child relationship with automatic cleanup
  - Loads are deleted when press run is deleted

- **purchase_items**: `press_run_loads.purchase_item_id → purchase_items.id`
  - **Critical traceability link**: Farm → Purchase → Press → Batch
  - Maintains complete supply chain tracking
  - Enables cost attribution from source to final product

- **apple_varieties**: `press_run_loads.apple_variety_id → apple_varieties.id`
  - Direct variety tracking for blend management
  - Supports variety-specific quality measurements

### 3. User Attribution (RBAC)
- **Both tables** include `created_by` and `updated_by` references
- Follows existing audit pattern from the codebase
- Enables role-based access control and change tracking

## Data Flow Integration

### Upstream (Source)
```
Vendor → Purchase → Purchase Items → Press Run Loads
```
- Purchase items provide the source fruit for pressing
- Maintains cost and traceability from source

### Downstream (Destination)
```
Press Runs → Vessel Assignment → Future Juice Lots
```
- Press runs assign juice to vessels
- Sets up for fermentation workflow

### Cross-cutting (Audit)
```
All Changes → Audit Logs (via existing audit system)
Users ←→ RBAC Authorization
```

## Cardinality Summary

| Relationship | Cardinality | Cascade Behavior |
|--------------|-------------|------------------|
| vendors → press_runs | 1:N | RESTRICT (vendor cannot be deleted if press runs exist) |
| vessels → press_runs | 1:N | SET NULL (press run remains if vessel deleted) |
| users → press_runs (created_by) | 1:N | SET NULL (preserve press run if user deleted) |
| users → press_runs (updated_by) | 1:N | SET NULL (preserve press run if user deleted) |
| press_runs → press_run_loads | 1:N | CASCADE (loads deleted with press run) |
| purchase_items → press_run_loads | 1:N | RESTRICT (purchase item cannot be deleted if used in press) |
| apple_varieties → press_run_loads | 1:N | RESTRICT (variety cannot be deleted if used in press) |

## Index Strategy for Performance

### Primary Query Patterns
1. **Mobile App Queries**:
   - Get press runs by vendor and status
   - Get loads for a specific press run in sequence order
   - Filter press runs by date range and status

2. **Reporting Queries**:
   - Press run history by vendor
   - Traceability from purchase item to press loads
   - Cost attribution through press runs

### Index Coverage
- **press_runs**: vendor_id, status, scheduled_date, start_time
- **press_run_loads**: press_run_id, purchase_item_id, load_sequence
- **Composite indexes** for common filtered queries

## Audit Integration

### Automatic Audit Logging
The existing `auditLogs` system will automatically capture:
- All CRUD operations on press_runs and press_run_loads
- Complete before/after snapshots of data changes
- User attribution and timestamps
- IP address and session tracking

### Audit Query Examples
```sql
-- Get all changes to a press run
SELECT * FROM audit_logs
WHERE table_name = 'press_runs' AND record_id = '<press_run_id>';

-- Get user activity on press operations
SELECT * FROM audit_logs
WHERE table_name IN ('press_runs', 'press_run_loads')
  AND changed_by = '<user_id>';
```

## Future Extensibility

### Planned Integrations
1. **Juice Lots**: press_runs → juice_lots (future)
2. **Cost Allocation**: Detailed cost tracking through press operations
3. **Quality Metrics**: Expanded measurement tracking
4. **Equipment Integration**: Press equipment assignment and maintenance

### Schema Evolution
- Enum values can be extended (e.g., new status types)
- Additional measurement columns can be added
- Relationship tables for complex many-to-many needs

This relationship structure ensures the ApplePress system integrates seamlessly with existing domain entities while providing the mobile-specific features needed for efficient pressing operations.