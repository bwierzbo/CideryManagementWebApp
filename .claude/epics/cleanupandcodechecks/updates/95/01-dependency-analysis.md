# Issue #95: Dependency Management - Analysis Phase

## Current Status: Dependency Analysis Complete

Date: 2024-09-28
Phase: Analysis and Planning

## Depcheck Analysis Results

### Root Package Dependencies
**Unused devDependencies at root level:**
- @playwright/test
- @types/glob
- @types/node
- @vitest/coverage-v8
- @vitest/ui
- concurrently
- depcheck
- glob
- knip
- madge
- prettier
- ts-prune
- tsx
- typescript
- vitest

*Note: These appear unused at root level due to monorepo structure - need careful evaluation*

### Apps/Web Package
**Unused dependencies:**
- @trpc/next (regular dependency)

**Unused devDependencies:**
- @testing-library/user-event
- @types/jest
- @vitest/coverage-v8
- autoprefixer
- postcss

**Missing dependencies:**
- webpack-bundle-analyzer (referenced in next.config.js)
- src (invalid path imports in some components)

### Packages/API Package
**Unused dependencies:**
- decimal.js

**Unused devDependencies:**
- @vitest/coverage-v8

**Missing dependencies:**
- msw-trpc (test dependency)
- msw (test dependency)

### Packages/DB Package
**Unused devDependencies:**
- @vitest/coverage-v8

**Missing dependencies:**
- postgres (referenced in connection.ts)

### Packages/Lib Package
**Unused devDependencies:**
- @vitest/coverage-v8

### Packages/Worker Package
**Unused devDependencies:**
- @vitest/coverage-v8

## Key Findings

### 1. Consistent Issues
- **@vitest/coverage-v8** is unused in ALL packages - likely a configuration issue
- Test dependencies missing in several packages (msw, msw-trpc)

### 2. Configuration Issues
- Invalid path imports in some React components
- Missing webpack-bundle-analyzer despite being referenced

### 3. Potential Cleanups
- @trpc/next appears genuinely unused in web package
- decimal.js unused in API package
- Several dev tools unused in web package

### 4. Version Consistency Check Needed
Need to audit for version drift across packages for shared dependencies.

## Next Steps

1. **Fix Missing Dependencies**: Add msw, msw-trpc, webpack-bundle-analyzer, postgres
2. **Remove Unused Dependencies**: Carefully remove unused dependencies after validation
3. **Fix Coverage Configuration**: Resolve @vitest/coverage-v8 usage or remove
4. **Fix Import Issues**: Resolve invalid src imports
5. **Version Consolidation**: Check for version drift in shared dependencies

## Risk Assessment

**Low Risk Removals:**
- @testing-library/user-event (web)
- @types/jest (web)
- decimal.js (api)

**Medium Risk Removals:**
- @trpc/next (web) - verify not used in build process
- autoprefixer, postcss (web) - verify Tailwind config

**High Risk / Investigation Needed:**
- Root level dev dependencies - many may be used by scripts
- Coverage dependencies - need to fix configuration first

## Estimated Impact

- **Bundle Size Reduction**: 2-5MB estimated
- **Install Time**: 10-20% improvement
- **Maintenance**: Reduced dependency surface area