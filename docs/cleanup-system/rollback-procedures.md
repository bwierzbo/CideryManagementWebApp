# Cleanup System Rollback Procedures

## Overview

This document provides comprehensive rollback procedures for all cleanup operations. Each cleanup category has specific rollback requirements, timelines, and validation procedures to ensure complete system recovery.

## Table of Contents

1. [Emergency Response](#emergency-response)
2. [Category-Specific Rollbacks](#category-specific-rollbacks)
3. [Database Recovery](#database-recovery)
4. [System Validation](#system-validation)
5. [Prevention and Monitoring](#prevention-and-monitoring)

## Emergency Response

### Immediate Actions (0-5 minutes)

1. **Stop All Running Operations**
   ```bash
   # Kill cleanup processes
   pkill -f "cleanup|analysis"

   # Stop CI/CD if running
   gh workflow view cleanup-checks.yml --json state
   # Cancel if running: gh run cancel <run-id>
   ```

2. **Assess Damage Scope**
   ```bash
   # Check git status
   git status

   # Check for build failures
   pnpm build 2>&1 | tee build_error.log

   # Check for test failures
   pnpm test 2>&1 | tee test_error.log
   ```

3. **Initiate Communication**
   - Notify team via established channels
   - Document incident start time
   - Assign incident commander

### Critical System Check (5-10 minutes)

1. **Database Connectivity**
   ```bash
   psql $DATABASE_URL -c "SELECT version();"
   ```

2. **Core Application Status**
   ```bash
   pnpm --filter web run build
   pnpm --filter api run build
   ```

3. **Data Integrity Verification**
   ```bash
   pnpm db:test
   ```

## Category-Specific Rollbacks

### Code Cleanup Rollback

**Scenario**: Removed code causing build/runtime failures
**Timeline**: 10-15 minutes
**Risk Level**: Medium

#### Step 1: Identify Changes (2-3 minutes)
```bash
# Review recent commits
git log --oneline -n 10

# Check specific file changes
git diff HEAD~1 --stat

# Identify removed files
git log --name-status --diff-filter=D HEAD~1..HEAD
```

#### Step 2: Selective Restoration (5-7 minutes)
```bash
# Restore specific files
git checkout HEAD~1 -- path/to/removed/file.ts

# Restore specific exports
git show HEAD~1:path/to/file.ts > temp_restore.ts
# Manual merge of required exports

# Restore entire directories if needed
git checkout HEAD~1 -- packages/lib/utils/
```

#### Step 3: Validation (3-5 minutes)
```bash
# Verify build success
pnpm build

# Run affected tests
pnpm test -- --related

# Check type coverage
pnpm typecheck
```

#### Rollback Verification Checklist
- [ ] Build completes successfully
- [ ] All tests pass
- [ ] No TypeScript errors
- [ ] Core functionality works
- [ ] No missing imports

### Asset Cleanup Rollback

**Scenario**: Missing assets causing runtime failures
**Timeline**: 5-10 minutes
**Risk Level**: Low

#### Step 1: Identify Missing Assets (1-2 minutes)
```bash
# Check for 404 errors in logs
grep -r "404" logs/ | grep -E "\.(png|jpg|svg|css|js)$"

# Review asset changes
git diff HEAD~1 --name-status | grep -E "\.(png|jpg|svg|css|js)$"
```

#### Step 2: Restore Assets (2-5 minutes)
```bash
# Restore entire asset directories
git checkout HEAD~1 -- public/images/
git checkout HEAD~1 -- apps/web/src/assets/

# Restore specific assets
git checkout HEAD~1 -- public/logo.png
```

#### Step 3: Verify Asset Loading (2-3 minutes)
```bash
# Start dev server
pnpm --filter web run dev

# Check browser console for 404s
# Navigate through key application pages
```

#### Rollback Verification Checklist
- [ ] No 404 errors for assets
- [ ] Images load correctly
- [ ] Styles apply properly
- [ ] Icons display correctly

### Database Cleanup Rollback

**Scenario**: Database operations affecting data integrity
**Timeline**: 15-30 minutes
**Risk Level**: High

#### Step 1: Immediate Assessment (2-5 minutes)
```bash
# Check database connectivity
psql $DATABASE_URL -c "SELECT NOW();"

# Review recent database operations
psql $DATABASE_URL -c "
  SELECT schemaname, tablename, attname, description
  FROM pg_description
  JOIN pg_attribute ON pg_description.objoid = pg_attribute.attrelid
  WHERE description LIKE '%DEPRECATED%'
  ORDER BY schemaname, tablename, attname;
"

# Check for data loss
pnpm db:test
```

#### Step 2: Database Restoration (5-15 minutes)

**Option A: Deprecation Rollback (Preferred - 5-10 minutes)**
```bash
# Revert deprecation markers
psql $DATABASE_URL -c "
  SELECT obj_description(oid, 'pg_class')
  FROM pg_class
  WHERE obj_description(oid, 'pg_class') LIKE '%DEPRECATED%';
"

# Remove deprecation comments
pnpm db:undeprecate --target-date=$(date -v-1H +%Y-%m-%d\ %H:%M:%S)
```

**Option B: Full Database Restore (15-20 minutes)**
```bash
# Stop all connections
psql $DATABASE_URL -c "
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE datname = current_database() AND pid <> pg_backend_pid();
"

# Restore from backup
psql $DATABASE_URL < backup_$(date +%Y%m%d)_*.sql
```

#### Step 3: Data Integrity Validation (5-10 minutes)
```bash
# Run database tests
pnpm db:test

# Verify core data integrity
psql $DATABASE_URL -c "
  SELECT
    schemaname,
    tablename,
    n_tup_ins,
    n_tup_upd,
    n_tup_del
  FROM pg_stat_user_tables
  ORDER BY schemaname, tablename;
"

# Test application connectivity
pnpm --filter api run dev &
sleep 10
curl http://localhost:3001/api/health
pkill -f "api.*dev"
```

#### Rollback Verification Checklist
- [ ] Database connectivity restored
- [ ] All tests pass
- [ ] Data integrity verified
- [ ] Application starts successfully
- [ ] Core queries execute properly
- [ ] No orphaned data
- [ ] Foreign key constraints intact

### Dependency Cleanup Rollback

**Scenario**: Removed dependencies causing build/runtime failures
**Timeline**: 10-20 minutes
**Risk Level**: Medium

#### Step 1: Identify Missing Dependencies (2-3 minutes)
```bash
# Check build errors for missing modules
pnpm build 2>&1 | grep -E "Cannot find module|Module not found"

# Review package.json changes
git diff HEAD~1 package.json packages/*/package.json
```

#### Step 2: Restore Dependencies (5-10 minutes)
```bash
# Restore package.json files
git checkout HEAD~1 -- package.json
git checkout HEAD~1 -- packages/*/package.json

# Reinstall dependencies
rm -rf node_modules packages/*/node_modules
pnpm install
```

#### Step 3: Validation (3-7 minutes)
```bash
# Verify installation
pnpm install --frozen-lockfile

# Test build
pnpm build

# Run tests
pnpm test
```

#### Rollback Verification Checklist
- [ ] All dependencies installed
- [ ] Build completes successfully
- [ ] All tests pass
- [ ] No missing module errors
- [ ] Development server starts

### Import Path Rollback

**Scenario**: Import path changes causing module resolution failures
**Timeline**: 5-10 minutes
**Risk Level**: Low

#### Step 1: Identify Import Issues (1-2 minutes)
```bash
# Check TypeScript errors
pnpm typecheck 2>&1 | grep -E "Cannot find module|Module.*not found"

# Review import changes
git diff HEAD~1 | grep -E "^[+-].*import.*from"
```

#### Step 2: Restore Import Paths (3-5 minutes)
```bash
# Restore specific files with import changes
git diff HEAD~1 --name-only | xargs git checkout HEAD~1 --
```

#### Step 3: Validation (2-3 minutes)
```bash
# Check TypeScript compilation
pnpm typecheck

# Verify build
pnpm build
```

#### Rollback Verification Checklist
- [ ] No TypeScript errors
- [ ] All imports resolve correctly
- [ ] Build succeeds
- [ ] IDE shows no errors

### Configuration Cleanup Rollback

**Scenario**: Removed configuration causing system failures
**Timeline**: 5-15 minutes
**Risk Level**: Medium

#### Step 1: Identify Configuration Issues (2-3 minutes)
```bash
# Check for missing config files
git diff HEAD~1 --name-status | grep -E "\.(json|js|ts|yml|yaml)$" | grep "^D"

# Review configuration changes
git diff HEAD~1 -- "*.json" "*.config.*" ".eslintrc*" "tsconfig*.json"
```

#### Step 2: Restore Configuration (2-7 minutes)
```bash
# Restore configuration files
git checkout HEAD~1 -- .eslintrc.json
git checkout HEAD~1 -- tsconfig.json
git checkout HEAD~1 -- vitest.config.ts
git checkout HEAD~1 -- package.json

# Restore directory configurations
git checkout HEAD~1 -- .vscode/
git checkout HEAD~1 -- .github/
```

#### Step 3: Validation (1-5 minutes)
```bash
# Test configuration validity
pnpm lint
pnpm typecheck
pnpm build
```

#### Rollback Verification Checklist
- [ ] All configuration files present
- [ ] Linting works correctly
- [ ] TypeScript compilation succeeds
- [ ] Build process works
- [ ] Development tools function

## Database Recovery

### Non-Destructive Recovery (Preferred)

The database safety system uses deprecation rather than deletion, making recovery straightforward:

```bash
# List deprecated elements
psql $DATABASE_URL -c "
  SELECT
    'table' as type,
    schemaname,
    tablename as name,
    obj_description(oid, 'pg_class') as description
  FROM pg_tables t
  JOIN pg_class c ON c.relname = t.tablename
  WHERE obj_description(oid, 'pg_class') LIKE '%DEPRECATED%'
  UNION ALL
  SELECT
    'column' as type,
    schemaname,
    tablename || '.' || attname as name,
    col_description(attrelid, attnum) as description
  FROM pg_tables t
  JOIN pg_attribute a ON a.attrelid = (schemaname||'.'||tablename)::regclass
  WHERE col_description(attrelid, attnum) LIKE '%DEPRECATED%';
"

# Remove deprecation markers
pnpm db:undeprecate --before="$(date -v-1H +%Y-%m-%d\ %H:%M:%S)"
```

### Emergency Database Recovery

If non-destructive recovery is insufficient:

```bash
# 1. Stop all application connections
systemctl stop application-services

# 2. Create emergency backup
pg_dump $DATABASE_URL > emergency_backup_$(date +%Y%m%d_%H%M%S).sql

# 3. Restore from pre-cleanup backup
psql $DATABASE_URL < backup_pre_cleanup.sql

# 4. Verify restoration
pnpm db:test

# 5. Restart services
systemctl start application-services
```

## System Validation

### Complete System Health Check

After any rollback operation:

```bash
#!/bin/bash
echo "=== Complete System Health Check ==="

echo "1. Git Status"
git status

echo "2. Dependencies"
pnpm install --frozen-lockfile

echo "3. Build Process"
pnpm build

echo "4. Test Suite"
pnpm test

echo "5. Type Checking"
pnpm typecheck

echo "6. Linting"
pnpm lint

echo "7. Database Connectivity"
psql $DATABASE_URL -c "SELECT version();"

echo "8. Database Tests"
pnpm db:test

echo "9. Development Server"
timeout 30 pnpm --filter web run dev &
sleep 20
curl -f http://localhost:3000/health || echo "FAILED: Dev server health check"
pkill -f "web.*dev"

echo "10. API Server"
timeout 30 pnpm --filter api run dev &
sleep 15
curl -f http://localhost:3001/api/health || echo "FAILED: API health check"
pkill -f "api.*dev"

echo "=== Health Check Complete ==="
```

### Performance Validation

```bash
# Measure current performance
pnpm analysis:bundle > rollback_performance.json

# Compare with baseline
diff analysis/reports/baseline/bundle-analysis.json rollback_performance.json

# Check for performance regressions
if [ $? -ne 0 ]; then
  echo "WARNING: Performance differences detected"
  echo "Review rollback_performance.json for details"
fi
```

## Prevention and Monitoring

### Monitoring Setup

1. **Automated Health Checks**
   ```yaml
   # .github/workflows/health-check.yml
   schedule:
     - cron: '*/15 * * * *'  # Every 15 minutes
   ```

2. **Alert Thresholds**
   - Build failure: Immediate alert
   - Test failure: Immediate alert
   - Performance regression >10%: Warning
   - Performance regression >25%: Critical

3. **Rollback Triggers**
   - Automatic rollback on critical failures
   - Manual rollback approval for warnings
   - Emergency rollback procedures for data issues

### Best Practices for Rollback Prevention

1. **Comprehensive Testing**
   - Always use dry-run mode first
   - Test in staging environment
   - Gradual rollout of changes

2. **Backup Strategy**
   - Automated backups before operations
   - Multiple restore points
   - Offsite backup storage

3. **Monitoring and Alerting**
   - Real-time health monitoring
   - Performance regression detection
   - Automated failure notification

4. **Documentation and Training**
   - Keep rollback procedures updated
   - Regular rollback drills
   - Team training on emergency procedures

### Emergency Contact Information

- **Incident Commander**: [Primary Contact]
- **Database Administrator**: [DB Admin Contact]
- **DevOps Engineer**: [DevOps Contact]
- **Development Lead**: [Dev Lead Contact]

### Escalation Matrix

| Severity | Response Time | Escalation |
|----------|---------------|------------|
| Critical | 5 minutes | Immediate - All teams |
| High | 15 minutes | Development + DevOps |
| Medium | 30 minutes | Development team |
| Low | 1 hour | Assigned developer |

## Post-Rollback Procedures

1. **Document the Incident**
   - Root cause analysis
   - Timeline of events
   - Lessons learned
   - Prevention measures

2. **System Improvements**
   - Update rollback procedures
   - Enhance monitoring
   - Improve testing coverage
   - Update documentation

3. **Team Communication**
   - Share incident report
   - Update training materials
   - Review prevention strategies
   - Schedule follow-up reviews

## Rollback Testing

Regular testing of rollback procedures ensures they work when needed:

```bash
# Monthly rollback drill
pnpm test:rollback-drill

# Quarterly full system recovery test
pnpm test:disaster-recovery

# Annual complete system restoration
pnpm test:full-recovery
```

Remember: The best rollback is the one you never need to use. Proper testing, monitoring, and gradual deployment are the keys to preventing situations that require emergency rollbacks.