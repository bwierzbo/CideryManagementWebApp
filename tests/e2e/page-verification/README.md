# Page Verification System

This directory contains the comprehensive page verification system for the Cidery Management App, implemented as part of Issue #11.

## Overview

The Page Verification System provides automated discovery and testing of all Next.js App Router pages, ensuring they load correctly, render properly, and meet performance requirements.

## Key Components

### 1. Page Discovery (`utils/page-discovery.ts`)
- **Automated page discovery**: Scans the Next.js App Router file system to find all `page.tsx` files
- **Route mapping**: Converts file paths to URL routes (handles route groups, dynamic routes)
- **Page categorization**: Separates public vs authenticated pages
- **Metadata enrichment**: Assigns expected titles, critical components, and test data requirements
- **Section organization**: Groups pages by functional areas (auth, main, production, admin)

**Key Features**:
- Discovers pages automatically without hardcoding
- Handles Next.js 13+ App Router conventions
- Provides metadata for comprehensive testing
- Validates expected core pages are present

### 2. Page Verifier (`page-objects/page-verifier.ts`)
- **Comprehensive verification**: Performs 8 different types of validation per page
- **Load time testing**: Ensures pages load within 3 seconds (configurable)
- **UI component validation**: Checks that critical components are present and visible
- **Responsive design testing**: Validates pages work across desktop, tablet, and mobile
- **Accessibility compliance**: Basic accessibility checks (headings, alt text, labels)
- **Demo data visibility**: Validates ≥95% of seeded data is visible through UI
- **Navigation testing**: Ensures navigation links work correctly
- **Error handling**: Tests error states and fallback UI

**Verification Results**: Each page receives a score (0-100) and detailed pass/fail results for each check.

### 3. Performance Monitor (`utils/performance-monitor.ts`)
- **Core Web Vitals**: Measures FCP, LCP, CLS when available
- **Load time tracking**: Precise millisecond timing
- **Network monitoring**: Tracks slow requests and total payload size
- **Memory usage**: JavaScript heap size monitoring
- **Performance scoring**: Algorithm that weighs different metrics
- **Recommendations**: Actionable performance improvement suggestions

### 4. Test Suites

#### Page Discovery Tests (`page-discovery-simple.test.ts`)
- Validates the page discovery system works correctly
- Tests file system scanning and route mapping
- Verifies page categorization and metadata assignment
- **No dependencies**: Works without database or web server
- **Fast execution**: Completes in seconds

#### Page Load Verification (`page-load-verification.test.ts`)
- Tests actual page loading and rendering
- Validates UI components are present
- Checks performance requirements
- Tests responsive design
- **Requires web server**: Needs the Next.js app running

#### Comprehensive Verification (`comprehensive-page-verification.test.ts`)
- Full end-to-end page verification suite
- Tests all discovered pages with complete validation
- Generates detailed reports and summaries
- **Requires database and auth**: Full integration testing

## Usage

### Quick Page Discovery Test (No Setup Required)
```bash
pnpm playwright test tests/e2e/page-verification/page-discovery-simple.test.ts --config=playwright-standalone.config.ts
```

### Page Load Verification (Requires Running Server)
```bash
# Start the development server first
pnpm --filter web run dev

# Run page load tests
pnpm playwright test tests/e2e/page-verification/page-load-verification.test.ts --config=playwright-page-verification.config.ts
```

### Full Comprehensive Verification (Requires Full Setup)
```bash
# Requires database setup and test data
pnpm test:e2e tests/e2e/page-verification/comprehensive-page-verification.test.ts
```

## Test Results and Reporting

### Console Output
Each test provides detailed console output showing:
- Pages discovered and their categorization
- Load times and performance scores
- Critical component verification results
- Responsive design test results
- Overall pass/fail statistics

### JSON Reports
Test results are exported to:
- `test-results/page-verification-results.json` - Detailed test results
- `test-results/standalone-results.json` - Discovery test results

### HTML Reports
Playwright generates interactive HTML reports in:
- `test-results/page-verification-report/` - Visual test results with screenshots

## Configuration Files

### `playwright-standalone.config.ts`
- For tests that don't need database or web server
- Fast execution for CI/CD pipelines
- Used for page discovery validation

### `playwright-page-verification.config.ts`
- For tests that need web server but not database
- Used for basic page load and UI verification
- Reuses existing development server

### `playwright.config.ts` (Main)
- Full E2E configuration with database setup
- Used for comprehensive verification tests
- Includes global setup/teardown

## Discovered Pages

The system automatically discovers these core pages:

### Public Pages (No Authentication Required)
- **Home** (`/`) - Landing page with navigation and quick actions
- **Auth Signin** (`/auth/signin`) - Login form
- **Auth Test** (`/auth/test`) - Authentication testing page

### Authenticated Pages (Login Required)
- **Dashboard** (`/dashboard`) - Main dashboard with widgets and data
- **Purchasing** (`/purchasing`) - Vendor management and purchase tracking
- **Pressing** (`/pressing`) - Press runs and juice lot management
- **Cellar** (`/cellar`) - Fermentation vessels and batch tracking
- **Packaging** (`/packaging`) - Packaging runs and inventory management
- **Admin** (`/admin`) - User management and system administration

## Test Data Requirements

The system identifies which pages need specific test data:

- **Vendors & Purchases**: Purchasing page
- **Press Runs & Juice Lots**: Pressing page
- **Vessels & Batches**: Cellar page
- **Packaging Runs & Inventory**: Packaging page
- **Users & Audit Logs**: Admin page
- **General Dashboard Data**: Dashboard page

## Performance Requirements

All pages are tested against these requirements:

- **Load Time**: ≤3 seconds (configurable)
- **First Contentful Paint**: ≤2 seconds (when measurable)
- **Largest Contentful Paint**: ≤2.5 seconds (when measurable)
- **Cumulative Layout Shift**: ≤0.1 (when measurable)
- **Demo Data Visibility**: ≥95% of seeded data visible
- **Critical Components**: 100% of defined components present

## Success Criteria (Issue #11 Requirements)

✅ **Automated discovery**: Discovers all Next.js App Router pages automatically
✅ **Load time verification**: All pages load within 3 seconds
✅ **UI component validation**: Critical components are identified and verified
✅ **Navigation testing**: Inter-page navigation verified
✅ **Demo data validation**: ≥95% of seeded data visible through UI
✅ **Responsive design**: Pages work across desktop, tablet, mobile viewports
✅ **Accessibility compliance**: Basic accessibility checks implemented
✅ **Error handling**: Error states and fallback UI tested
✅ **Comprehensive reporting**: Detailed results with scores and recommendations

## Integration with CI/CD

The page verification system is designed for continuous integration:

1. **Fast Discovery Tests**: Run on every commit (no dependencies)
2. **Load Verification**: Run on PR creation (requires dev server)
3. **Full Verification**: Run nightly or on release (requires full setup)

## Future Enhancements

- **Visual regression testing**: Screenshot comparison across releases
- **Lighthouse integration**: Full performance audit scores
- **Advanced accessibility**: axe-core integration for WCAG compliance
- **Cross-browser testing**: Extend to Firefox, Safari, Edge
- **API endpoint discovery**: Automatic API route testing
- **Content validation**: Semantic content verification

## Troubleshooting

### Common Issues

**Page Discovery Finds No Pages**
- Check that the app uses Next.js 13+ App Router
- Verify `apps/web/src/app` directory structure
- Ensure `page.tsx` files exist (not `page.js`)

**Load Tests Fail with Connection Refused**
- Ensure development server is running on port 3002
- Check that `pnpm --filter web run dev` is active
- Verify no firewall blocking localhost:3002

**Performance Tests Fail**
- Development mode is naturally slower than production
- Adjust performance thresholds if needed
- Check network conditions and system load

**Critical Components Not Found**
- Review component selectors in `getCriticalComponentSelectors()`
- Update selectors to match actual rendered HTML
- Add custom `data-testid` attributes to components

### Debug Mode

Run tests with additional debug information:
```bash
DEBUG=pw:api pnpm playwright test --headed --debug
```

This enables:
- Visual browser window
- Step-by-step execution
- Detailed API logs
- Interactive debugging