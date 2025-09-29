# Cleanup System Troubleshooting Guide

## Overview

This comprehensive troubleshooting guide covers common issues, error scenarios, and resolution procedures for the cleanup system. It includes diagnostic commands, recovery procedures, and escalation paths for critical situations.

## Table of Contents

1. [Diagnostic Commands](#diagnostic-commands)
2. [Common Issues](#common-issues)
3. [Error Scenarios](#error-scenarios)
4. [Recovery Procedures](#recovery-procedures)
5. [Performance Issues](#performance-issues)
6. [CI/CD Integration Issues](#cicd-integration-issues)
7. [Database Issues](#database-issues)
8. [Emergency Recovery](#emergency-recovery)
9. [Known Limitations](#known-limitations)
10. [Escalation Procedures](#escalation-procedures)

## Diagnostic Commands

### System Health Check
```bash
# Comprehensive system health check
pnpm cleanup:health-check

# Individual component checks
pnpm cleanup:check-dependencies
pnpm cleanup:check-build-system
pnpm cleanup:check-database
pnpm cleanup:check-analysis-tools
```

### Analysis Tool Diagnostics
```bash
# Test individual analysis tools
pnpm analysis:test-knip
pnpm analysis:test-ts-prune
pnpm analysis:test-depcheck
pnpm analysis:test-madge

# Validate tool configurations
pnpm analysis:validate-config
```

### Environment Diagnostics
```bash
# Check environment setup
node --version
pnpm --version
git --version
psql --version

# Check required environment variables
echo $DATABASE_URL
echo $NODE_ENV
echo $CI

# Verify disk space and permissions
df -h
ls -la node_modules/.bin/
```

### Report Generation Diagnostics
```bash
# Test report generation
pnpm reports:test-generation

# Validate report formats
pnpm reports:validate-json
pnpm reports:validate-markdown
```

## Common Issues

### 1. Build Failures After Cleanup

**Symptoms**:
- Build process fails with module not found errors
- TypeScript compilation errors
- Import/export resolution failures

**Diagnostic Steps**:
```bash
# Check for missing dependencies
pnpm install --frozen-lockfile
pnpm audit

# Validate TypeScript configuration
pnpm typecheck --listFiles

# Check for broken imports
pnpm analysis:imports --validate
```

**Common Causes & Solutions**:

**Missing Dependencies**:
```bash
# Restore from backup
git checkout HEAD~1 -- package.json
pnpm install

# Or add missing dependency
pnpm add missing-package
```

**Broken Import Paths**:
```bash
# Analyze import issues
pnpm analysis:imports --broken-only

# Fix automatically where possible
pnpm cleanup:fix-imports
```

**TypeScript Configuration Issues**:
```bash
# Validate tsconfig files
pnpm typecheck --showConfig

# Reset to known good configuration
git checkout HEAD~1 -- tsconfig*.json
```

### 2. Test Failures After Cleanup

**Symptoms**:
- Unit tests fail with module resolution errors
- Integration tests fail due to missing components
- Test coverage drops unexpectedly

**Diagnostic Steps**:
```bash
# Run tests with verbose output
pnpm test --verbose --no-coverage

# Check test configuration
pnpm test --showConfig

# Analyze test dependencies
pnpm analysis:test-deps
```

**Common Solutions**:

**Missing Test Dependencies**:
```bash
# Check for removed test utilities
git diff HEAD~1 -- "**/*.test.*" "**/*.spec.*"

# Restore necessary test files
git checkout HEAD~1 -- path/to/test/utils
```

**Mock Configuration Issues**:
```bash
# Validate mock configurations
pnpm test:validate-mocks

# Update mock imports
pnpm test:fix-mocks
```

### 3. Performance Regressions

**Symptoms**:
- Build time increases after cleanup
- Bundle size grows unexpectedly
- Runtime performance degrades

**Diagnostic Steps**:
```bash
# Compare performance metrics
pnpm analysis:performance --compare-baseline

# Analyze bundle composition
pnpm analysis:bundle --detailed

# Profile build process
pnpm build --profile
```

**Common Solutions**:

**Bundle Size Increases**:
```bash
# Analyze bundle bloat
pnpm analysis:bundle-bloat

# Check for duplicate dependencies
pnpm analysis:duplicates

# Optimize imports
pnpm cleanup:optimize-imports
```

**Build Time Regressions**:
```bash
# Profile TypeScript compilation
pnpm build --extendedDiagnostics

# Check for circular dependencies
pnpm analysis:circular-deps

# Optimize build configuration
pnpm cleanup:optimize-build-config
```

### 4. Database Connection Issues

**Symptoms**:
- Database analysis fails
- Migration failures
- Connection timeouts

**Diagnostic Steps**:
```bash
# Test database connectivity
psql $DATABASE_URL -c "SELECT version();"

# Check connection pool status
pnpm db:pool-status

# Validate database schema
pnpm db:validate-schema
```

**Common Solutions**:

**Connection Pool Exhaustion**:
```bash
# Check for connection leaks
pnpm db:check-connections

# Reset connection pool
pnpm db:reset-pool
```

**Schema Validation Failures**:
```bash
# Check for schema drift
pnpm db:check-schema-drift

# Apply pending migrations
pnpm db:migrate
```

## Error Scenarios

### Analysis Tool Failures

#### Knip Configuration Errors
```bash
# Error: knip configuration invalid
# Solution: Validate and fix configuration
pnpm analysis:validate-knip-config
cp analysis/config/knip.json.backup analysis/config/knip.json
```

#### TypeScript Compilation Errors
```bash
# Error: TypeScript compilation failed during analysis
# Solution: Fix TypeScript errors first
pnpm typecheck --noEmit
# Then re-run analysis
pnpm analysis:dead-code
```

#### Dependency Analysis Failures
```bash
# Error: depcheck unable to parse files
# Solution: Check for syntax errors
pnpm lint --fix
pnpm analysis:deps --skip-parse-errors
```

### Cleanup Operation Failures

#### Partial Cleanup Completion
```bash
# Error: Cleanup operation failed midway
# Solution: Check what was completed and resume
git status
pnpm cleanup:resume --from-checkpoint
```

#### Permission Errors
```bash
# Error: EACCES permission denied
# Solution: Fix file permissions
chmod +x node_modules/.bin/*
sudo chown -R $USER:$USER node_modules
```

#### Disk Space Exhaustion
```bash
# Error: No space left on device
# Solution: Clean up temporary files
pnpm cleanup:temp-files
rm -rf node_modules/.cache
```

### CI/CD Pipeline Failures

#### Quality Gate Failures
```bash
# Error: Quality gates failed in CI
# Solution: Run local analysis and fix issues
pnpm analysis:quality-gates --local
pnpm cleanup:fix-quality-issues
```

#### Timeout Errors
```bash
# Error: CI timeout during analysis
# Solution: Optimize analysis scope
export ANALYSIS_TIMEOUT=3600
pnpm analysis:fast-mode
```

#### Artifact Upload Failures
```bash
# Error: Unable to upload analysis artifacts
# Solution: Check artifact size and format
ls -lh reports/
pnpm reports:compress-artifacts
```

## Recovery Procedures

### Immediate Recovery (1-5 minutes)

#### Quick Rollback
```bash
# Immediate code rollback
git reset --hard HEAD~1
pnpm install

# Verify recovery
pnpm build
pnpm test
```

#### Dependency Recovery
```bash
# Restore package.json files
git checkout HEAD~1 -- "**/package.json"
pnpm install --frozen-lockfile
```

#### Database Recovery
```bash
# Restore database from backup
psql $DATABASE_URL < rollback-backup/database_backup.sql
```

### Comprehensive Recovery (5-30 minutes)

#### Full System Restore
```bash
# Restore all configuration files
git checkout HEAD~1 -- "**/*.json" "**/*.config.*" "**/*.yml"

# Reinstall all dependencies
rm -rf node_modules pnpm-lock.yaml
pnpm install

# Rebuild everything
pnpm build:all

# Run full test suite
pnpm test:all
```

#### Selective Recovery
```bash
# Restore specific components
git checkout HEAD~1 -- packages/api/
git checkout HEAD~1 -- packages/db/

# Partial reinstall
pnpm install --filter api --filter db

# Targeted testing
pnpm test --filter api --filter db
```

### Advanced Recovery (30+ minutes)

#### Manual Inspection and Recovery
```bash
# Compare changes systematically
git diff HEAD~1..HEAD

# Restore files one by one
git checkout HEAD~1 -- problematic/file.ts

# Incremental testing
pnpm test specific-test-suite
```

## Performance Issues

### Bundle Size Optimization

#### Large Bundle Size After Cleanup
**Diagnosis**:
```bash
pnpm analysis:bundle --detailed
pnpm analysis:duplicates
```

**Solutions**:
```bash
# Remove duplicate dependencies
pnpm dedupe

# Optimize imports
pnpm cleanup:optimize-imports

# Enable tree shaking
pnpm cleanup:enable-tree-shaking
```

### Build Performance

#### Slow Build Times
**Diagnosis**:
```bash
pnpm build --profile
pnpm analysis:build-bottlenecks
```

**Solutions**:
```bash
# Optimize TypeScript configuration
pnpm cleanup:optimize-tsconfig

# Enable incremental compilation
pnpm cleanup:enable-incremental

# Parallelize builds
pnpm cleanup:optimize-build-parallelization
```

### Runtime Performance

#### Memory Usage Issues
**Diagnosis**:
```bash
pnpm analysis:memory-usage
node --inspect build/index.js
```

**Solutions**:
```bash
# Optimize imports
pnpm cleanup:optimize-memory-imports

# Remove memory leaks
pnpm analysis:memory-leaks
```

## CI/CD Integration Issues

### GitHub Actions Failures

#### Workflow Configuration Issues
```bash
# Validate workflow syntax
yamllint .github/workflows/cleanup-analysis.yml

# Test workflow locally
act -j cleanup-analysis
```

#### Environment Variable Issues
```bash
# Check required variables
gh secret list
gh variable list

# Validate in workflow
echo "Environment check:"
echo "DATABASE_URL: ${DATABASE_URL:0:20}..."
echo "NODE_ENV: $NODE_ENV"
```

#### Timeout Issues
```bash
# Increase timeout in workflow
timeout-minutes: 30

# Optimize analysis for CI
export CI_MODE=true
pnpm analysis:ci-optimized
```

### Quality Gate Issues

#### False Positives
```bash
# Review quality gate thresholds
cat .github/workflows/cleanup-analysis.yml | grep -A 10 "Quality Gates"

# Adjust thresholds temporarily
export MAX_DEAD_CODE_FILES=10
export MAX_UNUSED_DEPS=5
```

#### Inconsistent Results
```bash
# Check for environment differences
diff <(pnpm list --depth=0) <(cat ci-dependencies.txt)

# Standardize environments
pnpm install --frozen-lockfile
```

## Database Issues

### Migration Failures

#### Phase 1 Deprecation Issues
```bash
# Check migration status
pnpm db:migration-status

# Validate deprecation migrations
pnpm db:validate-deprecations

# Rollback deprecation migration
pnpm db:rollback-deprecation
```

#### Schema Validation Failures
```bash
# Check schema integrity
pnpm db:check-schema

# Repair schema if needed
pnpm db:repair-schema
```

### Data Integrity Issues

#### Orphaned Data Detection
```bash
# Check for orphaned records
pnpm db:check-orphaned-data

# Clean up orphaned data
pnpm db:cleanup-orphaned-data --dry-run
pnpm db:cleanup-orphaned-data --apply
```

#### Referential Integrity Issues
```bash
# Validate foreign key constraints
pnpm db:check-foreign-keys

# Repair referential integrity
pnpm db:repair-foreign-keys
```

## Emergency Recovery

### Critical System Failure

#### Complete System Restore
```bash
# Emergency full rollback
git reset --hard origin/main
rm -rf node_modules pnpm-lock.yaml
pnpm install

# Emergency database restore
psql $DATABASE_URL < emergency_backup.sql

# Verify system functionality
pnpm build && pnpm test
```

#### Service Recovery
```bash
# Stop all running services
pkill -f "node\|pnpm"

# Clear all caches
rm -rf node_modules/.cache
rm -rf .next/cache
rm -rf dist/

# Full reinstall and rebuild
pnpm install
pnpm build:all
```

### Data Recovery

#### Backup Validation and Restore
```bash
# Validate backup integrity
pg_restore --list backup.dump

# Selective restore
pg_restore --table=specific_table backup.dump

# Full restore with verification
psql $DATABASE_URL < backup.sql
pnpm db:verify-restore
```

## Known Limitations

### Analysis Tool Limitations

1. **Knip**: May not detect dynamic imports in certain patterns
2. **ts-prune**: Cannot analyze runtime-only dependencies
3. **depcheck**: May miss dependencies used in config files
4. **madge**: Performance degrades with very large codebases

### Database Cleanup Limitations

1. **Phase 1 only**: Destructive operations require manual approval
2. **Complex relationships**: Some foreign key relationships need manual analysis
3. **Legacy data**: Older data patterns may not be automatically detectable

### CI Integration Limitations

1. **Timeout constraints**: Large repositories may exceed CI timeouts
2. **Resource limits**: Memory/CPU constraints in CI environment
3. **Concurrent builds**: Multiple concurrent analyses may conflict

## Escalation Procedures

### Level 1: Self-Service (0-30 minutes)
1. Check this troubleshooting guide
2. Run diagnostic commands
3. Attempt documented solutions
4. Check recent commits for related changes

### Level 2: Team Lead (30-60 minutes)
1. Contact development team lead
2. Provide diagnostic output
3. Share recent change history
4. Include error logs and symptoms

### Level 3: Senior Engineer (1-2 hours)
1. Escalate to senior engineer
2. Provide complete system state
3. Include performance metrics
4. Share attempted solutions

### Level 4: Emergency (Critical Issues)
1. Contact on-call engineer
2. Implement emergency rollback
3. Document incident details
4. Schedule post-incident review

### Emergency Contacts

- **Development Team Lead**: [Contact Information]
- **Senior Engineer**: [Contact Information]
- **On-Call Engineer**: [Emergency Contact]
- **System Administrator**: [Contact Information]

### Incident Documentation

For each incident, document:
1. **Timeline**: When issue started and was resolved
2. **Symptoms**: Exact error messages and behaviors
3. **Root Cause**: What caused the issue
4. **Resolution**: Steps taken to resolve
5. **Prevention**: How to prevent recurrence

### Post-Incident Actions

1. **Update Documentation**: Add new scenarios to this guide
2. **Tool Improvements**: Enhance analysis tools if needed
3. **Process Updates**: Improve procedures based on learnings
4. **Training**: Share learnings with team

## Best Practices for Troubleshooting

1. **Always backup before major operations**
2. **Use dry-run mode to preview changes**
3. **Verify one component at a time**
4. **Document unusual findings**
5. **Test in development environment first**
6. **Keep detailed logs of troubleshooting steps**
7. **Share solutions with the team**

## Support Resources

- [Operation Guide](./operation-guide.md)
- [Rollback Procedures](./rollback-procedures.md)
- [Tool Configuration](./tool-configuration.md)
- [Team Training Materials](./team-training.md)
- [CI Integration Guide](../ci-integration.md)
- [Database Safety System](../../DATABASE_SAFETY_SYSTEM.md)

---

**Remember**: When in doubt, prefer safety over speed. It's better to take additional time to diagnose properly than to cause additional issues through hasty fixes.