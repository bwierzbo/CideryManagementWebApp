# Cleanup System Operation Guide

## Overview

The cleanup system provides comprehensive automated analysis and cleanup capabilities for the cidery management application. This guide covers all operational procedures, safety checks, and best practices for using the cleanup system effectively.

## Table of Contents

1. [Prerequisites and Setup](#prerequisites-and-setup)
2. [Cleanup Categories](#cleanup-categories)
3. [Operation Procedures](#operation-procedures)
4. [Safety Checks](#safety-checks)
5. [Performance Impact](#performance-impact)
6. [Validation and Verification](#validation-and-verification)
7. [Emergency Procedures](#emergency-procedures)

## Prerequisites and Setup

### Environment Requirements

- Node.js 18+ with pnpm package manager
- PostgreSQL database access
- Git repository with clean working directory
- CI/CD pipeline access (for automated runs)
- Backup and restore capabilities

### Pre-Operation Checklist

1. **Verify Clean Working Directory**
   ```bash
   git status
   # Should show no uncommitted changes
   ```

2. **Create Backup**
   ```bash
   # Database backup
   pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

   # Code backup
   git stash push -m "Pre-cleanup backup $(date)"
   ```

3. **Verify Dependencies**
   ```bash
   pnpm install
   pnpm build
   pnpm test
   ```

4. **Check System Resources**
   - Minimum 4GB free disk space
   - Minimum 2GB available RAM
   - Database connection stable

## Cleanup Categories

### 1. Code Cleanup
**Purpose**: Remove unused exports, dead code, and orphaned files
**Tools**: knip, ts-prune, custom scanners
**Risk Level**: Medium
**Estimated Time**: 5-15 minutes

### 2. Asset Cleanup
**Purpose**: Consolidate duplicate assets and remove unused files
**Tools**: Custom asset scanner, file analysis
**Risk Level**: Low
**Estimated Time**: 2-5 minutes

### 3. Database Cleanup
**Purpose**: Deprecate unused schema elements and optimize structure
**Tools**: Database scanner, deprecation system
**Risk Level**: High
**Estimated Time**: 10-30 minutes

### 4. Dependency Cleanup
**Purpose**: Remove unused dependencies and optimize package structure
**Tools**: depcheck, custom dependency analysis
**Risk Level**: Medium
**Estimated Time**: 5-10 minutes

### 5. Import Path Normalization
**Purpose**: Optimize import paths and barrel file usage
**Tools**: Custom import analyzer
**Risk Level**: Low
**Estimated Time**: 3-8 minutes

### 6. Configuration Cleanup
**Purpose**: Remove unused configuration files and optimize settings
**Tools**: Configuration scanner
**Risk Level**: Medium
**Estimated Time**: 2-5 minutes

## Operation Procedures

### Full System Analysis

**Command**: `pnpm analysis:all`

1. **Execute Analysis**
   ```bash
   pnpm analysis:all
   ```

2. **Review Results**
   ```bash
   # Check analysis reports
   ls -la analysis/reports/baseline/
   cat analysis/reports/baseline/analysis-report.md
   ```

3. **Validate Findings**
   - Review dead code detection results
   - Verify dependency analysis
   - Check asset duplication reports
   - Validate database deprecation candidates

### Category-Specific Operations

#### Code Cleanup

1. **Run Dead Code Analysis**
   ```bash
   pnpm analysis:dead-code
   ```

2. **Review Results**
   ```bash
   cat analysis/reports/baseline/dead-code.json
   ```

3. **Apply Safe Removals**
   ```bash
   # Review each file before removal
   pnpm cleanup:code --dry-run
   pnpm cleanup:code --apply
   ```

4. **Verify Build Integrity**
   ```bash
   pnpm build
   pnpm test
   ```

#### Asset Cleanup

1. **Run Asset Analysis**
   ```bash
   pnpm analysis:assets
   ```

2. **Review Duplicates**
   ```bash
   cat analysis/reports/baseline/assets.json
   ```

3. **Consolidate Assets**
   ```bash
   pnpm cleanup:assets --dry-run
   pnpm cleanup:assets --apply
   ```

#### Database Cleanup

1. **Run Database Analysis**
   ```bash
   pnpm analysis:database
   ```

2. **Review Deprecation Candidates**
   ```bash
   cat analysis/reports/baseline/database.json
   ```

3. **Apply Deprecations (NON-DESTRUCTIVE)**
   ```bash
   pnpm db:deprecate --dry-run
   pnpm db:deprecate --apply
   ```

4. **Verify Database Integrity**
   ```bash
   pnpm db:test
   ```

#### Dependency Cleanup

1. **Run Dependency Analysis**
   ```bash
   pnpm analysis:deps
   ```

2. **Review Unused Dependencies**
   ```bash
   cat analysis/reports/baseline/deps-check.json
   ```

3. **Remove Unused Dependencies**
   ```bash
   pnpm cleanup:deps --dry-run
   pnpm cleanup:deps --apply
   ```

4. **Verify Installation**
   ```bash
   pnpm install
   pnpm build
   pnpm test
   ```

### Automated CI Integration

The cleanup system integrates with GitHub Actions for automated analysis:

1. **Trigger Conditions**
   - Push to main/develop/epic/ branches
   - Pull request creation/updates
   - Daily scheduled runs

2. **Quality Gates**
   - Maximum bundle size: 1000KB
   - Maximum build time: 120 seconds
   - Maximum dead code files: 5
   - Maximum unused dependencies: 3
   - Maximum circular dependencies: 0

3. **PR Comments**
   - Automated analysis reports
   - Performance impact summaries
   - Quality gate status
   - Optimization recommendations

## Safety Checks

### Pre-Operation Safety

1. **Backup Verification**
   ```bash
   # Verify backup exists and is readable
   ls -la backup_*.sql
   psql $DATABASE_URL -c "SELECT version();"
   ```

2. **Clean Working Directory**
   ```bash
   git status
   # Must show clean working directory
   ```

3. **Build and Test Success**
   ```bash
   pnpm build && pnpm test
   # Must pass without errors
   ```

### During Operation Safety

1. **Dry Run First**
   - Always use `--dry-run` flag initially
   - Review all proposed changes
   - Validate impact assessment

2. **Incremental Changes**
   - Apply changes in small batches
   - Verify each batch before proceeding
   - Commit changes incrementally

3. **Continuous Monitoring**
   - Monitor build output
   - Watch for test failures
   - Check performance metrics

### Post-Operation Safety

1. **Build Verification**
   ```bash
   pnpm build
   ```

2. **Test Suite Execution**
   ```bash
   pnpm test
   ```

3. **Performance Validation**
   ```bash
   pnpm analysis:bundle
   ```

4. **Database Integrity Check**
   ```bash
   pnpm db:test
   ```

## Performance Impact

### Expected Improvements

- **Bundle Size**: 5-15% reduction
- **Build Time**: 10-25% improvement
- **Dead Code**: 80-95% elimination
- **Dependencies**: 10-30% reduction
- **Type Check Time**: 15-30% improvement

### Performance Monitoring

1. **Baseline Measurement**
   ```bash
   # Before cleanup
   pnpm analysis:bundle > baseline_before.json
   time pnpm build > build_time_before.txt
   ```

2. **Post-Cleanup Measurement**
   ```bash
   # After cleanup
   pnpm analysis:bundle > baseline_after.json
   time pnpm build > build_time_after.txt
   ```

3. **Impact Analysis**
   ```bash
   # Compare results
   diff baseline_before.json baseline_after.json
   ```

### Performance Thresholds

- **Critical**: >25% improvement required
- **Warning**: 10-25% improvement expected
- **Info**: <10% improvement acceptable
- **Regression**: Any performance decrease requires investigation

## Validation and Verification

### Automated Validation

1. **CI Pipeline Checks**
   - Build success validation
   - Test suite execution
   - Quality gate compliance
   - Bundle size analysis

2. **Quality Gates**
   ```yaml
   MAX_BUNDLE_SIZE_KB: 1000
   MAX_BUILD_TIME_SECONDS: 120
   MAX_DEAD_CODE_FILES: 5
   MAX_UNUSED_DEPS: 3
   MAX_CIRCULAR_DEPS: 0
   ```

### Manual Verification

1. **Functional Testing**
   - Core feature validation
   - API endpoint testing
   - Database operation verification
   - UI component functionality

2. **Performance Testing**
   - Page load time measurement
   - API response time validation
   - Database query performance
   - Memory usage analysis

### Verification Checklist

- [ ] Build completes successfully
- [ ] All tests pass
- [ ] No new TypeScript errors
- [ ] No runtime errors in development
- [ ] Performance meets or exceeds baseline
- [ ] Database integrity maintained
- [ ] Dependencies resolve correctly
- [ ] CI pipeline passes
- [ ] Quality gates satisfied
- [ ] Manual testing successful

## Emergency Procedures

### Immediate Rollback

If critical issues are detected:

1. **Stop All Operations**
   ```bash
   # Kill any running processes
   pkill -f "pnpm|node"
   ```

2. **Restore from Backup**
   ```bash
   # Restore code
   git reset --hard HEAD~1
   git stash pop

   # Restore database
   psql $DATABASE_URL < backup_YYYYMMDD_HHMMSS.sql
   ```

3. **Verify Restoration**
   ```bash
   pnpm install
   pnpm build
   pnpm test
   ```

### Escalation Procedures

1. **Level 1**: Development team lead
2. **Level 2**: System administrator
3. **Level 3**: Database administrator
4. **Level 3**: DevOps engineer

### Emergency Contacts

- **Development Team**: [Contact Information]
- **System Admin**: [Contact Information]
- **Database Admin**: [Contact Information]
- **DevOps Team**: [Contact Information]

### Critical Recovery Commands

```bash
# Emergency database restore
psql $DATABASE_URL < backup_emergency.sql

# Emergency code rollback
git reset --hard origin/main

# Emergency dependency restore
rm -rf node_modules pnpm-lock.yaml
pnpm install

# Emergency build verification
pnpm build && pnpm test
```

## Best Practices

1. **Always backup before operations**
2. **Use dry-run mode first**
3. **Apply changes incrementally**
4. **Monitor continuously**
5. **Verify after each operation**
6. **Document any issues**
7. **Follow rollback procedures if needed**
8. **Communicate with team during operations**

## Troubleshooting

For detailed troubleshooting information, see [troubleshooting.md](./troubleshooting.md).

Common issues and solutions:
- Build failures after cleanup
- Test failures due to removed dependencies
- Performance regressions
- Database connection issues
- CI pipeline failures

## Next Steps

After successful cleanup operations:
1. Review performance improvements
2. Update documentation if needed
3. Share results with team
4. Schedule next cleanup cycle
5. Update baseline metrics
6. Commit and push changes
7. Monitor for any issues
8. Update quality gate thresholds if needed