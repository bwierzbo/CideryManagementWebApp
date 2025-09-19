# Task 002 Analysis: Single Purchase Order Reports

## Parallel Work Streams

### Stream A: PDF Template & Service Integration (Primary - 10-12 hours)
**File Patterns:**
- `packages/api/src/services/pdf/templates/PurchaseOrderTemplate.ts`
- `packages/api/src/services/pdf/templates/purchase-order-template.json`
- `packages/api/src/routers/reports.ts` (extension)
- `packages/api/src/routers/purchase.ts` (integration)

**Work Items:**
- Create `PurchaseOrderTemplate` class extending base PDF infrastructure from Task 001
- Implement professional invoice-style formatting with vendor details, line items, totals
- Add `generatePurchaseOrder` tRPC endpoint to reports router
- Integrate with existing purchase management API (`purchase.getById`)
- Add purchase order generation endpoint to purchase router
- Implement proper error handling and validation

### Stream B: Vendor Email Service (Independent - 8-10 hours)
**File Patterns:**
- `packages/api/src/services/email/VendorEmailService.ts`
- `packages/api/src/services/email/templates/purchase-order.html`
- `packages/api/src/services/email/templates/purchase-order.txt`
- `packages/api/src/routers/email.ts` (new router)
- `packages/api/src/routers/purchase.ts` (email endpoints)

**Work Items:**
- Develop `VendorEmailService` with Nodemailer integration
- Create HTML and plain text email templates for purchase orders
- Implement `emailPurchaseOrder` tRPC endpoint
- Add email delivery tracking and retry mechanisms
- Build template engine for dynamic content injection
- Add comprehensive audit logging for all email activities

### Stream C: UI Integration & Purchase Workflow (Depends on existing UI - 6-8 hours)
**File Patterns:**
- `apps/web/src/components/purchases/PurchaseOrderActions.tsx` (new component)
- `apps/web/src/components/purchases/VendorEmailModal.tsx` (new component)
- `apps/web/src/app/purchasing/page.tsx` (enhancement)
- `apps/web/src/components/purchases/PurchaseDetailView.tsx` (new component)

**Work Items:**
- Create `PurchaseOrderActions` component with PDF generation buttons
- Build `VendorEmailModal` for email composition with template selection
- Integrate PDF generation into existing purchase management UI (`RecentPurchases` component)
- Add one-click PDF generation from purchase detail views
- Implement delivery status monitoring and error feedback
- Update purchase history table with PDF/email action buttons

## Coordination Requirements

1. **Stream A must complete** PDF infrastructure integration before Stream B can test email attachments
2. **Stream C depends on** existing purchase management UI structure (already exists in `/apps/web/src/app/purchasing/page.tsx`)
3. **All streams need** vendor contact information from existing vendor management system
4. **Email infrastructure** needs to be configured (Nodemailer, SMTP settings)

## Definition of Done per Stream

### Stream A Complete:
- `PurchaseOrderTemplate` generates professional PDF with vendor details, line items, totals
- `reports.generatePurchaseOrder` endpoint accepts purchase ID and returns PDF stream
- `purchase.generatePdf` endpoint integrated into existing purchase router
- Error handling for missing purchase data or generation failures
- PDF template supports various purchase line configurations

### Stream B Complete:
- `VendorEmailService` sends emails with PDF attachments
- Email templates render purchase order data dynamically
- `purchase.emailPurchaseOrder` endpoint with delivery tracking
- Retry mechanism for failed email deliveries
- Comprehensive audit logging for all email activities
- Template selection supports multiple email formats

### Stream C Complete:
- `PurchaseOrderActions` component integrated into purchase history table
- `VendorEmailModal` provides email composition interface
- One-click PDF generation from purchase detail views
- Delivery status display with real-time updates
- Error handling provides clear user feedback
- UI components maintain responsive design patterns

## Integration Points

- Stream A provides PDF generation service interface that Stream B uses for email attachments
- Stream B creates email service that Stream C consumes via tRPC endpoints
- Stream C extends existing purchase management UI with new action components
- All streams integrate with existing vendor and purchase data models
- Email audit logging integrates with existing audit system