---
issue: 84
title: QA Updates and Export
analyzed: 2025-09-26T18:45:00Z
epic: cellartopackaging
---

# Issue #84: QA Updates and Export - Analysis

## Work Streams

### Stream A: QA Update API & Modal
**Agent Type**: general-purpose
**Files**:
- packages/api/src/routers/packaging.ts (add updateQA mutation)
- apps/web/src/components/packaging/qa-update-modal.tsx (new modal component)
- apps/web/src/app/packaging/[id]/page.tsx (integrate QA update button)

**Work**:
1. Create updateQA mutation in packaging router
2. Add QA fields validation with Zod schema
3. Implement audit logging for QA changes
4. Create QA update modal with form fields
5. Add validation for measurement ranges
6. Integrate modal into detail page
7. Add permission checks for QA role

### Stream B: CSV Export Implementation
**Agent Type**: general-purpose
**Files**:
- apps/web/src/components/packaging/packaging-table.tsx (enhance export)
- apps/web/src/app/packaging/page.tsx (add bulk export)
- packages/api/src/routers/packaging.ts (add export endpoint)

**Work**:
1. Enhance existing CSV export with all QA fields
2. Add batch selection for bulk export
3. Implement export progress indicators
4. Create comprehensive CSV format
5. Respect current filters in export

### Stream C: PDF Export & Reports
**Agent Type**: general-purpose
**Files**:
- apps/web/src/lib/pdf-generator.ts (new PDF utility)
- apps/web/src/app/packaging/[id]/page.tsx (add PDF export)
- apps/web/src/components/packaging/packaging-pdf-template.tsx (new template)

**Work**:
1. Install and configure jsPDF library
2. Create professional PDF template for packaging reports
3. Add PDF export button to detail page
4. Implement production report format
5. Include all QA measurements and batch data
6. Add print-friendly formatting

## Dependencies
- Stream A can start immediately (builds on existing API)
- Stream B can start immediately (enhances existing export)
- Stream C can start immediately (new functionality)
- All streams can work in parallel

## Coordination Notes
- Stream A modifies packaging router and detail page
- Stream B enhances existing table export
- Stream C adds new PDF functionality
- Minimal file conflicts expected