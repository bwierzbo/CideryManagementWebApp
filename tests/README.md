# Tests Directory

This directory contains test infrastructure, utilities, and fixtures shared across the monorepo.

## Structure

```
tests/
├── web/        # Web app specific test files
├── api/        # API package specific test files
├── db/         # Database package specific test files
├── lib/        # Lib package specific test files
├── worker/     # Worker package specific test files
├── utils/      # Shared test utilities
└── fixtures/   # Test data fixtures
```

## Package-specific Tests

Each package still maintains its own tests in their respective directories:
- `apps/web/tests/` or `apps/web/src/__tests__/`
- `packages/api/tests/` or `packages/api/src/__tests__/`
- `packages/db/tests/` or `packages/db/src/__tests__/`
- `packages/lib/src/__tests__/`
- `packages/worker/tests/` or `packages/worker/src/__tests__/`

## Running Tests

```bash
# Run all tests
pnpm test

# Run specific package tests
pnpm --filter web run test
pnpm --filter api run test
pnpm --filter db run test
pnpm --filter lib run test
pnpm --filter worker run test

# Run with coverage
pnpm test:coverage

# Run tests in watch mode
pnpm test:watch
```

## Coverage Requirements

All packages must maintain ≥95% code coverage across:
- Branches
- Functions
- Lines
- Statements