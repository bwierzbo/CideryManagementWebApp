# Database Deprecation Rollback Guide

This guide provides comprehensive procedures for rolling back database deprecation operations safely and effectively.

## Overview

The rollback system provides multiple levels of recovery for deprecation operations:

1. **Phase 1 Rollback**: Reverse element deprecation (rename back to original)
2. **Emergency Recovery**: Handle critical failures during operations
3. **Backup Restoration**: Restore from backups when rollback fails

## Quick Reference

### Emergency Commands
```bash
# Emergency rollback of specific migration
pnpm db:emergency-rollback --migration-id <id>

# Restore from backup
pnpm db:restore-backup --backup-id <id> --target-elements <elements>

# Health check after rollback
pnpm db:health-check --post-rollback
```

### Status Commands
```bash
# Check rollback status
pnpm db:rollback-status --migration-id <id>

# List available rollback plans
pnpm db:list-rollback-plans

# Validate rollback feasibility
pnpm db:validate-rollback --migration-id <id>
```

## Phase 1 Rollback Procedures

### Standard Rollback Process

#### 1. Pre-Rollback Assessment
```bash
# Assess rollback feasibility
pnpm db:assess-rollback --migration-id <migration_id>
```

**Assessment Criteria:**
- Migration is in completed state
- No subsequent migrations depend on this one
- Original elements can be safely restored
- No conflicts with current database state

#### 2. Create Rollback Plan
```bash
# Generate rollback plan
pnpm db:create-rollback-plan --migration-id <migration_id>
```

**Plan Components:**
- Step-by-step rollback sequence
- Dependency resolution order
- Validation checkpoints
- Estimated duration
- Risk assessment

#### 3. Validate Rollback Plan
```bash
# Test rollback plan
pnpm db:test-rollback --plan-id <plan_id>
```

**Validation Checks:**
- SQL syntax validation
- Dependency consistency
- Resource availability
- Timing constraints

#### 4. Execute Rollback
```bash
# Execute rollback with confirmation
pnpm db:execute-rollback --plan-id <plan_id> --confirm
```

**Execution Steps:**
1. Create pre-rollback backup
2. Stop monitoring for deprecated elements
3. Begin transaction
4. Execute rollback steps in order
5. Validate each step
6. Commit or rollback transaction
7. Update migration status

#### 5. Post-Rollback Verification
```bash
# Verify rollback completion
pnpm db:verify-rollback --plan-id <plan_id>
```

**Verification Checks:**
- Original elements restored
- Deprecated elements removed
- Dependencies intact
- Application functionality
- Performance baseline

### Example Rollback Scenario

**Scenario**: Rollback deprecation of unused table `user_preferences_deprecated_20250928_unused`

```bash
# 1. Check current status
pnpm db:rollback-status --migration-id dep_20250928140000_abc123

# 2. Create rollback plan
pnpm db:create-rollback-plan --migration-id dep_20250928140000_abc123

# 3. Review and test plan
pnpm db:test-rollback --plan-id plan_20250928141000_def456

# 4. Execute rollback
pnpm db:execute-rollback --plan-id plan_20250928141000_def456 --confirm

# 5. Verify completion
pnpm db:verify-rollback --plan-id plan_20250928141000_def456
```

## Emergency Recovery Procedures

### Critical Failure Scenarios

#### Scenario 1: Rollback Failure During Execution

**Symptoms:**
- Rollback process stopped mid-execution
- Database in inconsistent state
- Some elements restored, others not

**Recovery Steps:**

1. **Immediate Assessment**
   ```bash
   # Check database state
   pnpm db:emergency-assess --migration-id <id>

   # Identify failed steps
   pnpm db:rollback-status --detailed --migration-id <id>
   ```

2. **Stabilize Database**
   ```bash
   # Stop all related processes
   pnpm db:stop-all-operations --migration-id <id>

   # Create emergency backup
   pnpm db:emergency-backup --label "pre-recovery"
   ```

3. **Selective Recovery**
   ```bash
   # Resume rollback from last successful step
   pnpm db:resume-rollback --plan-id <id> --from-step <step_number>

   # OR restore specific elements
   pnpm db:restore-elements --backup-id <id> --elements <list>
   ```

#### Scenario 2: Database Corruption During Rollback

**Symptoms:**
- Database connection errors
- Data integrity violations
- Transaction log errors

**Recovery Steps:**

1. **Immediate Actions**
   ```bash
   # Stop all database operations
   sudo systemctl stop postgresql

   # Check database integrity
   pnpm db:check-integrity --force
   ```

2. **Restore from Backup**
   ```bash
   # Restore from pre-rollback backup
   pnpm db:restore-from-backup --backup-id <pre_rollback_backup>

   # Verify restoration
   pnpm db:verify-restore --comprehensive
   ```

3. **Re-plan Recovery**
   ```bash
   # Create new rollback plan with enhanced safety
   pnpm db:create-rollback-plan --migration-id <id> --safety-level maximum
   ```

#### Scenario 3: Application Breaking After Rollback

**Symptoms:**
- Application errors referencing restored elements
- Performance degradation
- Missing functionality

**Recovery Steps:**

1. **Assess Impact**
   ```bash
   # Check application logs
   pnpm db:check-app-logs --since-rollback

   # Analyze performance impact
   pnpm db:performance-analysis --baseline <pre_deprecation>
   ```

2. **Quick Fixes**
   ```bash
   # Recreate any missing dependencies
   pnpm db:recreate-dependencies --migration-id <id>

   # Update application configurations
   pnpm app:update-db-config --rollback-mode
   ```

3. **Full Recovery if Needed**
   ```bash
   # Re-deprecate if rollback was wrong decision
   pnpm db:re-deprecate --elements <list> --reason "rollback_recovery"
   ```

## Backup Restoration Procedures

### When to Use Backup Restoration

- Rollback procedures fail completely
- Database corruption detected
- Data loss occurred
- Multiple cascading failures

### Backup Restoration Process

#### 1. Identify Correct Backup
```bash
# List available backups for migration
pnpm db:list-backups --migration-id <id>

# Validate backup integrity
pnpm db:validate-backup --backup-id <backup_id>
```

#### 2. Prepare for Restoration
```bash
# Create current state backup (if possible)
pnpm db:emergency-backup --label "pre-restore"

# Stop all applications
pnpm app:stop-all --confirm

# Notify stakeholders
pnpm ops:notify --event backup_restore_starting
```

#### 3. Execute Restoration
```bash
# Restore from backup
pnpm db:restore-backup --backup-id <id> --mode full

# Verify restoration integrity
pnpm db:verify-restore --comprehensive
```

#### 4. Post-Restoration Steps
```bash
# Update database metadata
pnpm db:update-metadata --restored-from <backup_id>

# Restart applications
pnpm app:start-all --health-check

# Verify application functionality
pnpm app:health-check --comprehensive
```

## Rollback Decision Matrix

### When to Rollback vs. Fix Forward

| Scenario | Rollback | Fix Forward | Restore from Backup |
|----------|----------|-------------|-------------------|
| Minor application error | ❌ | ✅ | ❌ |
| Performance degradation | ⚠️ | ✅ | ❌ |
| Data integrity issue | ✅ | ❌ | ⚠️ |
| Multiple cascading failures | ❌ | ❌ | ✅ |
| Unknown dependencies found | ✅ | ⚠️ | ❌ |
| Regulatory compliance issue | ✅ | ❌ | ⚠️ |
| Critical business impact | ✅ | ❌ | ⚠️ |

**Legend:**
- ✅ Recommended approach
- ⚠️ Consider carefully
- ❌ Not recommended

## Safety Mechanisms

### Automatic Rollback Triggers

The system automatically initiates rollback in these scenarios:

1. **Critical Error Detection**
   - Database integrity violations
   - Transaction log corruption
   - Foreign key constraint failures

2. **Performance Thresholds**
   - Query response time increase > 50%
   - Connection pool exhaustion
   - CPU/Memory spikes > 90%

3. **Application Errors**
   - Error rate increase > 10%
   - Critical functionality failures
   - Authentication/authorization issues

### Manual Rollback Triggers

Operators should consider rollback when:

1. **Business Impact**
   - Critical features unavailable
   - Revenue-affecting issues
   - Customer-facing problems

2. **Operational Issues**
   - Monitoring systems failing
   - Backup processes affected
   - Security concerns

3. **Time Constraints**
   - Fix timeline exceeds rollback time
   - Business deadline pressure
   - Limited troubleshooting resources

## Rollback Testing Procedures

### Pre-Production Testing

#### 1. Test Environment Setup
```bash
# Clone production state to test environment
pnpm db:clone-to-test --source production --target test

# Apply deprecation migration
pnpm db:migrate --migration-id <id> --environment test
```

#### 2. Execute Test Rollback
```bash
# Create rollback plan for test
pnpm db:create-rollback-plan --migration-id <id> --environment test

# Execute rollback in test
pnpm db:execute-rollback --plan-id <plan_id> --environment test
```

#### 3. Validate Test Results
```bash
# Comprehensive validation
pnpm db:validate-rollback --plan-id <plan_id> --comprehensive

# Performance comparison
pnpm db:compare-performance --baseline pre_migration --current post_rollback
```

### Production Rollback Rehearsal

#### Monthly Rollback Drills
```bash
# Schedule rollback drill
pnpm ops:schedule-drill --type rollback --date <date>

# Execute drill with safety guards
pnpm db:drill-rollback --migration-id <recent_migration> --dry-run
```

#### Quarterly Full Testing
```bash
# Full rollback test on staging
pnpm db:full-rollback-test --environment staging --migrations recent_10
```

## Monitoring and Alerts

### Rollback Monitoring

**Key Metrics:**
- Rollback execution time
- Step success/failure rates
- Database performance during rollback
- Application error rates
- Recovery time objectives (RTO)

**Alert Thresholds:**
- Rollback time > estimated duration + 50%
- Any step failure
- Performance degradation > 20%
- Error rate increase > 5%

### Post-Rollback Monitoring

**Extended Monitoring Period:** 72 hours

**Critical Metrics:**
- Application functionality
- Database performance baseline
- Error rates and patterns
- User experience metrics

## Documentation and Communication

### Rollback Documentation Requirements

#### Pre-Rollback:
- [ ] Rollback plan reviewed and approved
- [ ] Stakeholder notifications sent
- [ ] Backup verification completed
- [ ] Team readiness confirmed

#### During Rollback:
- [ ] Real-time status updates
- [ ] Step-by-step execution log
- [ ] Any deviations documented
- [ ] Issue escalation if needed

#### Post-Rollback:
- [ ] Completion verification
- [ ] Performance impact assessment
- [ ] Lessons learned captured
- [ ] Process improvements identified

### Communication Templates

#### Rollback Initiation
```
Subject: Database Rollback Initiated - Migration <ID>

Team,

Database rollback has been initiated for migration <ID> due to <reason>.

Timeline:
- Start: <timestamp>
- Estimated completion: <timestamp>
- Expected impact: <description>

Current status updates will be provided every 15 minutes.

Contact: <oncall_contact>
```

#### Rollback Completion
```
Subject: Database Rollback Completed - Migration <ID>

Team,

Database rollback for migration <ID> has been completed successfully.

Results:
- Duration: <actual_time>
- Status: Success/Partial/Failed
- Impact: <description>
- Next steps: <actions>

All systems have been verified and are operating normally.
```

## Troubleshooting Common Issues

### Issue: Rollback Hangs on Specific Step

**Diagnosis:**
```bash
# Check for blocking queries
pnpm db:check-blocks --migration-id <id>

# Review transaction log
pnpm db:review-tx-log --since <rollback_start>
```

**Resolution:**
```bash
# Kill blocking sessions (if safe)
pnpm db:kill-blocking-sessions --migration-id <id>

# Resume rollback
pnpm db:resume-rollback --plan-id <id>
```

### Issue: Validation Failures After Rollback

**Diagnosis:**
```bash
# Detail validation failures
pnpm db:validation-details --plan-id <id>

# Check for partial rollback state
pnpm db:check-consistency --migration-id <id>
```

**Resolution:**
```bash
# Manual correction of specific issues
pnpm db:manual-fix --issue-id <id> --approved

# Re-run validation
pnpm db:revalidate --plan-id <id>
```

### Issue: Performance Problems After Rollback

**Diagnosis:**
```bash
# Compare performance metrics
pnpm db:performance-compare --baseline pre_migration --current now

# Analyze query patterns
pnpm db:analyze-queries --since-rollback
```

**Resolution:**
```bash
# Regenerate statistics
pnpm db:update-stats --tables <restored_tables>

# Rebuild affected indexes
pnpm db:rebuild-indexes --tables <restored_tables>
```

## Best Practices

### Planning
1. Always test rollback procedures in non-production first
2. Document all assumptions and dependencies
3. Validate rollback plans with multiple team members
4. Ensure adequate time windows for rollback operations

### Execution
1. Follow the documented procedure exactly
2. Validate each step before proceeding
3. Maintain real-time communication with stakeholders
4. Be prepared to escalate quickly if issues arise

### Recovery
1. Prioritize data integrity over convenience
2. Document all deviations and issues
3. Learn from each rollback experience
4. Update procedures based on lessons learned

Remember: A successful rollback is one that restores system stability while preserving data integrity and maintaining stakeholder confidence.