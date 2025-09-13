# E2E Test Suite

End-to-end testing infrastructure for the Cidery Management Application using Playwright.

## Directory Structure

```
tests/e2e/
├── auth/                    # Authentication & authorization tests
├── navigation/              # Navigation & routing tests
├── forms/                   # Form interactions & validation tests
├── workflows/               # Complete business workflow tests
├── visual/                  # Visual regression tests
├── page-objects/            # Page Object Model classes
├── fixtures/                # Test data fixtures & factories
├── utils/                   # Test utilities & helpers
├── global-setup.ts          # Global test setup & database seeding
├── global-teardown.ts       # Global test cleanup
└── README.md               # This file
```

## Test Categories

### Authentication Tests (`auth/`)
- Login/logout functionality
- Role-based access control
- Session management
- Password validation

### Navigation Tests (`navigation/`)
- Page routing and URL validation
- Menu navigation
- Breadcrumb functionality
- Deep linking

### Form Tests (`forms/`)
- Form field validation
- Data submission
- Error handling
- Auto-completion features

### Workflow Tests (`workflows/`)
- Complete business processes:
  - Vendor → Purchase → Press → Batch → Package → Inventory
  - User management workflows
  - Reporting workflows

### Visual Tests (`visual/`)
- Screenshot comparisons for critical UI components
- Responsive design validation
- Cross-browser consistency

## Running Tests

```bash
# Run all E2E tests
pnpm test:e2e

# Run with UI mode for debugging
pnpm test:e2e:ui

# Run in headed mode to see browser
pnpm test:e2e:headed

# Debug specific test
pnpm test:e2e:debug

# Generate test code
pnpm test:e2e:codegen
```

## Test Database

Tests use a separate test database to ensure isolation:
- Database is reset before each test run
- Minimal seed data is created in global setup
- Each test should create its own specific test data as needed

## Page Object Model

All page interactions should go through Page Object classes to:
- Reduce code duplication
- Make tests more maintainable
- Provide type-safe page interactions
- Abstract DOM selectors from test logic

## Test Data

Use the test data factories in `fixtures/` to create consistent test data:
- User factories for different roles
- Entity factories for business objects
- Relationship factories for complex data structures

## Best Practices

1. **Isolation**: Each test should be independent and not rely on other tests
2. **Page Objects**: Use page objects for all DOM interactions
3. **Test Data**: Create fresh test data for each test using factories
4. **Assertions**: Use specific assertions that provide clear failure messages
5. **Cleanup**: Tests should clean up their own data or use database transactions
6. **Parallelization**: Tests should be safe to run in parallel

## CI Integration

E2E tests are integrated into the GitHub Actions workflow and run:
- On pull requests to main branch
- On pushes to main branch
- Nightly for comprehensive testing

Test artifacts (screenshots, videos, traces) are uploaded on failure for debugging.