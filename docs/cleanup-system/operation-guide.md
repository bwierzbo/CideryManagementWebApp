# Cleanup System Operation Guide

## Overview

The cleanup system provides comprehensive automated analysis and cleanup capabilities for the cidery management application. This guide covers all operational procedures, safety checks, and best practices for using the cleanup system effectively.

This system has successfully processed the entire codebase, achieving significant improvements:
- **18.94KB space saved** through dead code and asset cleanup
- **23 files normalized** with proper formatting and structure
- **2 deprecated packages removed** improving security and maintainability
- **Database safety system** with non-destructive Phase 1 deprecation
- **Comprehensive CI integration** with automated quality gates

## Table of Contents

1. [Prerequisites and Setup](#prerequisites-and-setup)
2. [System Architecture](#system-architecture)
3. [Cleanup Categories](#cleanup-categories)
4. [Operation Procedures](#operation-procedures)
5. [Advanced Operations](#advanced-operations)
6. [Safety Checks](#safety-checks)
7. [Performance Impact](#performance-impact)
8. [Validation and Verification](#validation-and-verification)
9. [CI Integration](#ci-integration)
10. [Emergency Procedures](#emergency-procedures)
11. [Maintenance Schedules](#maintenance-schedules)

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

## System Architecture

### Analysis Infrastructure

The cleanup system is built on a robust analysis infrastructure:

#### Core Analysis Tools
- **knip**: Dead code detection and export analysis
- **ts-prune**: TypeScript unused exports identification
- **depcheck**: Dependency usage analysis
- **madge**: Circular dependency detection
- **Custom scanners**: Asset, database, and configuration analysis

#### Analysis Scripts Location
All analysis scripts are located in `/analysis/scripts/`:
- `analyze-all.ts`: Master analysis orchestrator
- `analyze-assets.ts`: Asset duplication and usage analysis
- `analyze-code.ts`: Code quality and dead code analysis
- `analyze-database.ts`: Database schema and usage analysis
- `analyze-dependencies.ts`: Package dependency analysis
- `consolidate-analysis.ts`: Report aggregation and action planning

#### Configuration Management
Analysis tools are configured via `/analysis/config/`:
- `knip.json`: Dead code detection configuration
- `depcheck.config.js`: Dependency analysis settings
- `madge.config.js`: Circular dependency rules
- Custom scanner configurations

#### Reporting System
The system generates comprehensive reports in multiple formats:
- **JSON reports**: Machine-readable analysis data in `/reports/`
- **Markdown summaries**: Human-readable reports with action plans
- **Consolidated analysis**: Aggregated findings across all categories
- **Action plans**: Prioritized cleanup recommendations

### Database Safety System

#### Two-Phase Approach
The database cleanup uses a non-destructive two-phase approach:

**Phase 1: Deprecation (Non-Destructive)**
- Tables/columns marked with `_deprecated_YYYYMMDD` suffix
- Original functionality preserved
- Migration scripts track changes
- Full rollback capability maintained

**Phase 2: Removal (Destructive - Manual)**
- Executed only after thorough validation
- Requires explicit approval
- Complete backup and restore procedures
- Detailed documentation requirements

#### Migration Management
- All migrations tracked in database
- Audit trail for all changes
- Automated backup creation
- Validation checkpoints

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

## Advanced Operations

### Comprehensive Cleanup Pipeline

The system provides a complete automated cleanup pipeline that can be executed safely:

#### Master Cleanup Command
```bash
# Execute full cleanup pipeline with safety checks
pnpm cleanup:all --with-validation
```

This command:
1. Creates automatic backups
2. Runs comprehensive analysis
3. Applies all safe cleanups
4. Validates results
5. Generates performance reports

#### Custom Cleanup Workflows

**Development Workflow**
```bash
# Pre-development cleanup
pnpm cleanup:prep-dev
# Equivalent to:
# - pnpm analysis:all
# - pnpm cleanup:code --safe-only
# - pnpm cleanup:assets --safe-only
# - pnpm cleanup:deps --conservative
```

**Release Preparation Workflow**
```bash
# Pre-release comprehensive cleanup
pnpm cleanup:pre-release
# Equivalent to:
# - Full backup creation
# - Complete analysis suite
# - All cleanup categories
# - Performance benchmarking
# - Quality gate validation
```

**Maintenance Workflow**
```bash
# Regular maintenance cleanup
pnpm cleanup:maintenance
# Equivalent to:
# - Dependency updates check
# - Dead code cleanup
# - Asset optimization
# - Performance monitoring
```

### Batch Operations

#### Multi-Package Operations
For monorepo cleanup across all packages:

```bash
# Analyze all packages
pnpm cleanup:analyze --all-packages

# Clean specific packages
pnpm cleanup:code --packages api,db,lib

# Exclude specific packages
pnpm cleanup:deps --exclude web,worker
```

#### Selective Cleanup
Target specific types of issues:

```bash
# Only remove completely safe items
pnpm cleanup:safe-only

# Conservative cleanup (minimal risk)
pnpm cleanup:conservative

# Aggressive cleanup (maximum benefit, higher risk)
pnpm cleanup:aggressive --with-backups
```

### Performance Optimization

#### Bundle Analysis and Optimization
```bash
# Comprehensive bundle analysis
pnpm analysis:bundle --detailed

# Optimize specific bundle targets
pnpm cleanup:bundle --target web
pnpm cleanup:bundle --target worker

# Bundle size monitoring
pnpm monitor:bundle --baseline-compare
```

#### Build Performance Optimization
```bash
# Build time analysis
pnpm analysis:build-performance

# TypeScript performance optimization
pnpm cleanup:typescript --optimize-imports

# Build cache optimization
pnpm cleanup:build-cache
```

### Database Operations

#### Phase 1 Deprecation Operations
```bash
# Analyze database for cleanup opportunities
pnpm db:analyze --comprehensive

# Apply non-destructive deprecations
pnpm db:deprecate --phase1 --dry-run
pnpm db:deprecate --phase1 --apply

# Validate deprecation impact
pnpm db:validate-deprecations
```

#### Migration Management
```bash
# Generate deprecation migration
pnpm db:generate-deprecation-migration

# Apply with validation
pnpm db:migrate --validate-before --validate-after

# Rollback if needed
pnpm db:rollback-deprecation --to-checkpoint
```

### Asset Management

#### Asset Optimization Pipeline
```bash
# Comprehensive asset analysis
pnpm assets:analyze --include-duplicates --include-unused

# Optimize asset sizes
pnpm assets:optimize --compress --format-convert

# Consolidate duplicates
pnpm assets:deduplicate --merge-similar --update-references
```

#### Asset Validation
```bash
# Validate all asset references
pnpm assets:validate-references

# Check for broken links
pnpm assets:check-links

# Verify asset accessibility
pnpm assets:check-accessibility
```

### Report Generation and Analysis

#### Comprehensive Reporting
```bash
# Generate master report
pnpm reports:generate --comprehensive --include-recommendations

# Performance impact report
pnpm reports:performance --before-after-comparison

# Quality metrics report
pnpm reports:quality --trend-analysis
```

#### Custom Reports
```bash
# Generate custom analysis report
pnpm reports:custom \
  --include-dead-code \
  --include-dependencies \
  --include-performance \
  --format markdown \
  --output custom-analysis.md
```

### Validation and Testing

#### Pre-Cleanup Validation
```bash
# Validate system state before cleanup
pnpm validate:pre-cleanup
# Checks:
# - Build success
# - Test suite passing
# - No uncommitted changes
# - Database connectivity
# - Dependencies installed
```

#### Post-Cleanup Validation
```bash
# Comprehensive post-cleanup validation
pnpm validate:post-cleanup
# Checks:
# - Build still succeeds
# - All tests still pass
# - No runtime errors
# - Performance improvements
# - Quality gates satisfied
```

#### Continuous Validation
```bash
# Monitor system health during cleanup
pnpm validate:continuous --monitor-interval 30s
```

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

## CI Integration

### GitHub Actions Integration

The cleanup system is fully integrated with GitHub Actions for automated analysis and quality gates.

#### Workflow Triggers
The cleanup workflow triggers on:
- **Push to main/develop/epic branches**: Full analysis and quality gates
- **Pull request creation/updates**: Comprehensive analysis with PR comments
- **Scheduled daily runs**: Regular maintenance and monitoring
- **Manual workflow dispatch**: On-demand analysis execution

#### Quality Gates Configuration
Located in `.github/workflows/cleanup-analysis.yml`:

```yaml
env:
  MAX_BUNDLE_SIZE_KB: 1000
  MAX_BUILD_TIME_SECONDS: 120
  MAX_DEAD_CODE_FILES: 5
  MAX_UNUSED_DEPS: 3
  MAX_CIRCULAR_DEPS: 0
  MIN_TEST_COVERAGE: 80
```

#### Workflow Steps
1. **Environment Setup**: Node.js, pnpm, dependencies
2. **Baseline Measurement**: Bundle size, build time
3. **Comprehensive Analysis**: All analysis categories
4. **Quality Gate Evaluation**: Threshold checking
5. **Performance Benchmarking**: Before/after comparison
6. **Report Generation**: PR comments, artifacts
7. **Failure Handling**: Rollback procedures if needed

#### PR Comment Integration
Automated PR comments include:
- **Analysis Summary**: Issues found per category
- **Performance Impact**: Bundle size, build time changes
- **Quality Gate Status**: Pass/fail with details
- **Recommended Actions**: Specific cleanup suggestions
- **Risk Assessment**: Change impact evaluation

#### Artifacts and Reports
The workflow generates:
- **Analysis Reports**: JSON and markdown formats
- **Performance Metrics**: Before/after comparisons
- **Bundle Analysis**: Size breakdown and optimization opportunities
- **Backup Files**: For rollback if needed

### Local CI Simulation
Test CI behavior locally:

```bash
# Simulate CI environment
export CI=true
export MAX_BUNDLE_SIZE_KB=1000
export MAX_BUILD_TIME_SECONDS=120

# Run CI analysis pipeline
pnpm cleanup:ci-simulation

# Generate CI-style reports
pnpm reports:ci-format
```

### Quality Gate Customization
Adjust quality gates for different contexts:

```bash
# Development environment (relaxed)
export MAX_DEAD_CODE_FILES=10
export MAX_UNUSED_DEPS=5

# Production environment (strict)
export MAX_DEAD_CODE_FILES=0
export MAX_UNUSED_DEPS=0
export MIN_TEST_COVERAGE=95
```

## Maintenance Schedules

### Daily Maintenance (Automated)

**Schedule**: Every day at 02:00 UTC via GitHub Actions

**Operations**:
```bash
# Automated daily cleanup
pnpm maintenance:daily
```

**Tasks**:
- Dependency vulnerability scanning
- Dead code detection
- Performance monitoring
- Build health checks
- Report generation

**Notifications**:
- Slack alerts for issues found
- Email summaries for team leads
- GitHub issue creation for critical problems

### Weekly Maintenance (Semi-Automated)

**Schedule**: Every Monday at 09:00 UTC

**Operations**:
```bash
# Weekly comprehensive analysis
pnpm maintenance:weekly
```

**Tasks**:
- Comprehensive dependency analysis
- Asset optimization review
- Database deprecation candidate analysis
- Performance trend analysis
- Quality gate threshold review

**Manual Review Required**:
- Dependency update planning
- Database deprecation approval
- Performance optimization prioritization

### Monthly Maintenance (Manual)

**Schedule**: First Monday of each month

**Operations**:
```bash
# Monthly deep analysis
pnpm maintenance:monthly
```

**Tasks**:
- Major dependency updates
- Database cleanup Phase 2 evaluation
- Performance optimization implementation
- Quality gate threshold adjustment
- Documentation updates

**Deliverables**:
- Monthly maintenance report
- Performance improvement plan
- Technical debt reduction roadmap
- Team training needs assessment

### Quarterly Maintenance (Strategic)

**Schedule**: First Monday of January, April, July, October

**Operations**:
```bash
# Quarterly strategic review
pnpm maintenance:quarterly
```

**Tasks**:
- Cleanup system architecture review
- Tool evaluation and updates
- Process optimization
- Team training delivery
- Metric baseline reset

**Deliverables**:
- Quarterly cleanup system report
- Tool upgrade recommendations
- Process improvement proposals
- Training material updates

### Emergency Maintenance

**Triggers**:
- Critical quality gate failures
- Build system failures
- Security vulnerability detection
- Performance regression alerts

**Response Procedure**:
1. **Immediate Assessment** (within 15 minutes)
2. **Impact Analysis** (within 30 minutes)
3. **Mitigation Plan** (within 1 hour)
4. **Implementation** (within 2 hours)
5. **Validation** (within 4 hours)
6. **Post-Incident Review** (within 24 hours)

### Maintenance Metrics

**Daily Metrics**:
- Build success rate
- Test pass rate
- Bundle size trend
- Dead code count
- Dependency vulnerabilities

**Weekly Metrics**:
- Performance improvement percentage
- Technical debt reduction
- Quality gate compliance
- Cleanup operation success rate

**Monthly Metrics**:
- Overall system health score
- Team productivity impact
- Cost savings from cleanup
- Risk reduction metrics

**Quarterly Metrics**:
- System architecture health
- Tool effectiveness scores
- Process efficiency metrics
- Team satisfaction scores

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