---
issue: 85
title: Integration Testing
analyzed: 2025-09-26T19:15:00Z
epic: cellartopackaging
---

# Issue #85: Integration Testing - Analysis

## Work Streams

### Stream A: E2E Test Suite & Infrastructure
**Agent Type**: test-runner
**Files**:
- apps/web/src/__tests__/packaging/e2e/bottling-flow.test.ts (new)
- apps/web/src/__tests__/packaging/e2e/test-helpers.ts (new)
- packages/db/src/test/factories/packaging-factory.ts (new)

**Work**:
1. Set up test infrastructure and helpers
2. Create test data factories for vessels, batches, packaging
3. Implement complete bottling flow E2E tests
4. Test cellar modal interactions
5. Test packaging run creation with validations

### Stream B: Component & Page Testing
**Agent Type**: test-runner
**Files**:
- apps/web/src/__tests__/packaging/pages/list.test.tsx (new)
- apps/web/src/__tests__/packaging/pages/detail.test.tsx (new)
- apps/web/src/__tests__/packaging/components/qa-modal.test.tsx (new)

**Work**:
1. Test packaging list page with filters and sorting
2. Test packaging detail page display
3. Test QA update modal functionality
4. Test export features (CSV/PDF)
5. Test responsive behavior

### Stream C: API & Data Integrity Testing
**Agent Type**: test-runner
**Files**:
- packages/api/src/routers/__tests__/packaging.test.ts (new)
- packages/db/src/test/packaging-integrity.test.ts (new)

**Work**:
1. Test all tRPC packaging endpoints
2. Test concurrent operations and race conditions
3. Test data integrity (vessel volumes, inventory)
4. Test rollback scenarios
5. Test permission checks and RBAC
6. Test audit logging accuracy

## Dependencies
- All streams can run in parallel as they test different layers
- Stream A focuses on E2E workflows
- Stream B focuses on UI components
- Stream C focuses on backend logic

## Coordination Notes
- Each stream creates tests in separate directories
- No file conflicts expected
- Can run all test suites independently