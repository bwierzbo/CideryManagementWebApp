# Database Deprecation Operational Procedures

This document provides comprehensive operational procedures for the database deprecation system, including day-to-day operations, maintenance tasks, and troubleshooting guidelines.

## Overview

The database deprecation system operates in two phases:
- **Phase 1**: Non-destructive deprecation with monitoring
- **Phase 2**: Permanent removal (documented separately)

This guide covers operational procedures for Phase 1 operations and ongoing system maintenance.

## Daily Operations

### System Health Checks

#### Morning Health Check (Daily)
```bash
# Check overall system status
pnpm db:health-check --comprehensive

# Review overnight monitoring alerts
pnpm db:review-alerts --since "yesterday"

# Check backup system status
pnpm db:backup-status --last-24h

# Validate monitoring system
pnpm db:monitor-health --deprecated-elements
```

#### Weekly System Review
```bash
# Generate weekly deprecation report
pnpm db:weekly-report --include-trends

# Review removal candidates
pnpm db:removal-candidates --min-age 30d

# System performance analysis
pnpm db:performance-review --deprecated-elements

# Cleanup old data
pnpm db:cleanup-old-data --retention-policy
```

### Monitoring Dashboard

#### Key Metrics to Monitor

**System Health:**
- Active deprecated elements: `<count>`
- Elements ready for removal: `<count>`
- Recent access events: `<count>`
- System alerts (last 24h): `<count>`

**Performance Metrics:**
- Monitoring system overhead: `<percentage>`
- Average alert response time: `<seconds>`
- Backup validation rate: `<percentage>`
- Storage usage by deprecated elements: `<MB>`

**Access Patterns:**
- Most accessed deprecated elements
- Access frequency trends
- Source analysis (applications, users, etc.)
- Query type distribution

#### Alert Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Deprecated element access | 1 per day | 5 per day |
| Monitoring system downtime | 5 minutes | 15 minutes |
| Backup validation failure | 1 failure | 2 consecutive failures |
| Storage growth rate | 10% per week | 25% per week |

### Routine Maintenance Tasks

#### Daily Tasks
```bash
# Process monitoring data
pnpm db:process-monitoring-data

# Update telemetry aggregations
pnpm db:update-telemetry --interval daily

# Check for system alerts
pnpm db:check-alerts --auto-acknowledge low-priority

# Validate active deprecations
pnpm db:validate-deprecations --quick-check
```

#### Weekly Tasks
```bash
# Generate comprehensive reports
pnpm db:generate-reports --type weekly

# Review and update removal candidates
pnpm db:update-removal-candidates

# Clean up old monitoring data
pnpm db:cleanup-monitoring --retention 90d

# Backup system validation
pnpm db:validate-backup-system --comprehensive
```

#### Monthly Tasks
```bash
# System performance review
pnpm db:performance-review --comprehensive --month

# Update deprecation policies
pnpm db:review-policies --update-if-needed

# Generate executive summary
pnpm db:executive-summary --month

# System optimization
pnpm db:optimize-system --deprecated-elements
```

## Operational Procedures

### Adding New Elements to Deprecation

#### 1. Pre-Deprecation Analysis
```bash
# Analyze element usage
pnpm db:analyze-usage --element <element_name> --days 30

# Check dependencies
pnpm db:check-dependencies --element <element_name>

# Generate impact assessment
pnpm db:impact-assessment --element <element_name>
```

#### 2. Create Deprecation Plan
```bash
# Create deprecation migration
pnpm db:create-deprecation --elements <element_list> --reason <reason>

# Review plan
pnpm db:review-plan --plan-id <plan_id>

# Test in staging
pnpm db:test-deprecation --plan-id <plan_id> --environment staging
```

#### 3. Execute Deprecation
```bash
# Execute with safety checks
pnpm db:execute-deprecation --plan-id <plan_id> --safety-level high

# Start monitoring
pnpm db:start-monitoring --elements <deprecated_elements>

# Verify completion
pnpm db:verify-deprecation --plan-id <plan_id>
```

### Managing Monitoring System

#### Monitoring Configuration
```bash
# View current monitoring config
pnpm db:show-monitoring-config

# Update monitoring settings
pnpm db:update-monitoring --config-file monitoring.json

# Add new monitoring rules
pnpm db:add-monitoring-rule --element <element> --threshold <value>
```

#### Alert Management
```bash
# View active alerts
pnpm db:list-alerts --status active

# Acknowledge alerts
pnpm db:acknowledge-alert --alert-id <id> --reason <reason>

# Configure alert channels
pnpm db:configure-alerts --channel slack --webhook <url>
```

#### Telemetry Management
```bash
# Export telemetry data
pnpm db:export-telemetry --period 30d --format csv

# Analyze usage trends
pnpm db:analyze-trends --elements <list> --period 90d

# Generate usage reports
pnpm db:usage-report --detailed --period monthly
```

### Backup and Recovery Operations

#### Backup Management
```bash
# List recent backups
pnpm db:list-backups --recent 10

# Validate backup integrity
pnpm db:validate-backup --backup-id <id>

# Test backup restoration
pnpm db:test-restore --backup-id <id> --test-db temp_test
```

#### Recovery Procedures
```bash
# Emergency backup creation
pnpm db:emergency-backup --label "incident_<ticket_id>"

# Restore specific elements
pnpm db:restore-elements --backup-id <id> --elements <list>

# Full system restore
pnpm db:full-restore --backup-id <id> --confirm-destructive
```

## Troubleshooting Guide

### Common Issues and Solutions

#### Issue: Monitoring System Not Recording Events

**Symptoms:**
- Zero events in monitoring dashboard
- No alerts for known deprecated element access
- Telemetry data appears stale

**Diagnosis:**
```bash
# Check monitoring service status
pnpm db:check-monitoring-status

# Verify monitoring configuration
pnpm db:verify-monitoring-config

# Test monitoring with known query
pnpm db:test-monitoring --query-deprecated-element
```

**Resolution:**
```bash
# Restart monitoring services
pnpm db:restart-monitoring

# Reconfigure monitoring
pnpm db:reconfigure-monitoring --reset-to-defaults

# Verify fix
pnpm db:test-monitoring --comprehensive
```

#### Issue: High Storage Usage by Deprecated Elements

**Symptoms:**
- Storage usage growing rapidly
- Performance degradation
- Backup sizes increasing

**Diagnosis:**
```bash
# Analyze storage usage
pnpm db:analyze-storage --deprecated-elements

# Check for data growth in deprecated tables
pnpm db:check-data-growth --deprecated-tables

# Review retention policies
pnpm db:review-retention-policies
```

**Resolution:**
```bash
# Identify removal candidates
pnpm db:removal-candidates --sort-by-size

# Cleanup old monitoring data
pnpm db:cleanup-monitoring --aggressive

# Consider expedited removal process
pnpm db:expedite-removal --elements <large_elements>
```

#### Issue: Alert Fatigue from Excessive Notifications

**Symptoms:**
- Too many low-priority alerts
- Important alerts getting missed
- Team disabling notifications

**Diagnosis:**
```bash
# Analyze alert patterns
pnpm db:analyze-alerts --period 7d

# Check alert frequency by type
pnpm db:alert-frequency --breakdown-by-type

# Review alert thresholds
pnpm db:review-thresholds --elements all
```

**Resolution:**
```bash
# Adjust alert thresholds
pnpm db:update-thresholds --less-sensitive

# Enable alert grouping
pnpm db:configure-alert-grouping --window 15m

# Add alert suppression rules
pnpm db:add-suppression-rule --pattern <pattern>
```

#### Issue: Performance Impact from Monitoring

**Symptoms:**
- Database queries running slower
- High CPU usage on monitoring
- Application timeouts

**Diagnosis:**
```bash
# Check monitoring overhead
pnpm db:monitoring-overhead --detailed

# Analyze query performance impact
pnpm db:analyze-query-impact --monitoring

# Review monitoring efficiency
pnpm db:monitoring-efficiency-report
```

**Resolution:**
```bash
# Optimize monitoring queries
pnpm db:optimize-monitoring --reduce-overhead

# Adjust monitoring frequency
pnpm db:update-monitoring-frequency --less-frequent

# Enable monitoring caching
pnpm db:enable-monitoring-cache
```

### Error Codes and Meanings

| Code | Description | Severity | Resolution |
|------|-------------|----------|------------|
| DEP001 | Element not found | Low | Verify element name and schema |
| DEP002 | Naming convention violation | Medium | Fix naming or use override |
| DEP003 | Safety check failed | High | Review safety requirements |
| DEP004 | Dependency conflict | High | Resolve dependencies first |
| DEP005 | Monitoring setup failed | Medium | Check monitoring configuration |
| DEP006 | Backup validation failed | Critical | Verify backup integrity |
| DEP007 | Rollback plan invalid | High | Recreate rollback plan |
| DEP008 | Permission denied | Critical | Check database permissions |

### Log Analysis

#### Common Log Patterns

**Successful Deprecation:**
```
[INFO] Starting deprecation migration: dep_20250928_abc123
[INFO] Safety checks passed for 3 elements
[INFO] Creating backup: backup_pre-migration_20250928_def456
[INFO] Executing deprecation steps...
[INFO] Step 1/3: Deprecating table user_preferences
[INFO] Step 2/3: Starting monitoring for deprecated elements
[INFO] Step 3/3: Updating migration status
[INFO] Deprecation completed successfully
```

**Failed Deprecation:**
```
[ERROR] Safety check failed: High-impact dependency detected
[ERROR] Element users.email has 15 foreign key references
[ERROR] Deprecation aborted due to safety check failure
[INFO] Cleaning up partial migration state
[INFO] Migration rolled back successfully
```

**Monitoring Alert:**
```
[WARN] Deprecated element accessed: table user_preferences_deprecated_20250928_unu
[WARN] Source: application (user-service:getUserPreferences)
[WARN] Query type: SELECT
[WARN] Alert threshold reached: 5 accesses in 1 hour
```

## Performance Optimization

### System Tuning

#### Monitoring System Optimization
```bash
# Enable query result caching
pnpm db:enable-cache --monitoring-queries

# Optimize monitoring query plans
pnpm db:optimize-monitoring-queries

# Adjust monitoring batch sizes
pnpm db:configure-batching --size 1000 --interval 30s
```

#### Storage Optimization
```bash
# Compress old monitoring data
pnpm db:compress-monitoring-data --older-than 30d

# Archive old deprecation metadata
pnpm db:archive-metadata --older-than 90d

# Optimize deprecated element storage
pnpm db:optimize-deprecated-storage
```

#### Alert System Optimization
```bash
# Enable alert deduplication
pnpm db:enable-alert-dedup --window 5m

# Optimize alert processing
pnpm db:optimize-alert-processing

# Configure alert batching
pnpm db:configure-alert-batching --max-batch 10
```

### Performance Monitoring

#### Key Performance Indicators

**System Performance:**
- Monitoring query execution time: `< 100ms average`
- Alert processing latency: `< 5 seconds`
- Backup validation time: `< 30 minutes`
- Storage growth rate: `< 5% per month`

**Operational Efficiency:**
- False positive alert rate: `< 2%`
- Deprecation success rate: `> 95%`
- Rollback success rate: `> 98%`
- Time to removal eligibility: `30-90 days average`

## Security Considerations

### Access Control

#### Required Permissions

**Deprecation Operations:**
- Database schema modification permissions
- Backup creation and validation access
- Monitoring system configuration access
- Alert system management permissions

**Monitoring Operations:**
- Read access to database metadata
- Write access to monitoring tables
- Alert channel configuration permissions
- Telemetry data export permissions

#### Audit Requirements

**Audit Log Requirements:**
- All deprecation operations logged
- Access to deprecated elements tracked
- Administrative actions recorded
- System configuration changes logged

```bash
# Generate audit report
pnpm db:audit-report --period monthly --include-all

# Check compliance
pnpm db:compliance-check --standard <standard_name>

# Export audit data
pnpm db:export-audit --format json --period 90d
```

### Data Protection

#### Sensitive Data Handling
```bash
# Check for sensitive data in deprecated elements
pnpm db:check-sensitive-data --elements <deprecated_list>

# Apply data masking if needed
pnpm db:mask-sensitive-data --tables <table_list>

# Verify data protection compliance
pnpm db:verify-data-protection --standard gdpr
```

## Integration with CI/CD

### Automated Checks

#### Pre-Deployment Validation
```bash
# Validate migration scripts
pnpm db:validate-migrations --new-only

# Check for deprecated element usage
pnpm db:check-usage --in-codebase

# Verify backup system readiness
pnpm db:verify-backup-readiness
```

#### Post-Deployment Monitoring
```bash
# Automated health check
pnpm db:automated-health-check --alert-on-failure

# Update monitoring configuration
pnpm db:update-monitoring --from-config

# Generate deployment report
pnpm db:deployment-report --migration-id <id>
```

### Pipeline Integration

#### Example CI/CD Pipeline Steps
```yaml
# .github/workflows/database-deprecation.yml
name: Database Deprecation Check

on:
  pull_request:
    paths:
      - 'packages/db/**'

jobs:
  deprecation-check:
    steps:
      - name: Validate deprecation migrations
        run: pnpm db:validate-migrations --new-only

      - name: Check for deprecated element usage
        run: pnpm db:check-codebase-usage

      - name: Test deprecation in staging
        run: pnpm db:test-deprecation --environment staging

      - name: Generate impact report
        run: pnpm db:impact-report --output pr-comment
```

## Conclusion

This operational guide provides the foundation for day-to-day management of the database deprecation system. Regular adherence to these procedures ensures safe, efficient, and auditable database evolution while maintaining system integrity and performance.

Key success factors:
1. **Consistent monitoring** of all deprecated elements
2. **Proactive maintenance** of the deprecation system
3. **Regular validation** of safety mechanisms
4. **Continuous improvement** based on operational experience

For additional support or complex scenarios not covered in this guide, escalate to the database administration team with detailed logs and error information.