---
issue: 80
title: Packaging API Router
analyzed: 2025-09-26T14:58:29Z
epic: cellartopackaging
---

# Issue #80: Packaging API Router - Analysis

## Work Streams

### Stream A: Core Router Implementation
**Agent Type**: general-purpose
**Files**:
- packages/api/src/routers/packaging.ts (new file)
- packages/api/src/routers/index.ts (add router export)

**Work**:
1. Create packaging router with tRPC procedures
2. Implement createFromCellar mutation with transaction
3. Add get and list queries for packaging runs
4. Export and integrate with main router

### Stream B: Helper Functions and Validation
**Agent Type**: general-purpose
**Files**:
- packages/api/src/utils/packaging.ts (new file for helpers)
- packages/api/src/routers/packaging.ts (extend with additional endpoints)

**Work**:
1. Implement lot code generation logic
2. Add updateQA mutation for QA field updates
3. Add getPackageSizes query for reference data
4. Implement validation helpers

## Dependencies
- Stream B depends on Stream A (needs core router first)
- Both can read from the database schema created in #78

## Coordination Notes
- Stream A creates the main router file
- Stream B extends it with additional functionality
- Both streams coordinate on packaging.ts file modifications