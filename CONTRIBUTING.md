# Contributing to Cidery Management Application

## Overview

Welcome to the Cidery Management Application! This guide covers contribution guidelines, code standards, and cleanup procedures to maintain a high-quality codebase.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Development Workflow](#development-workflow)
3. [Code Quality Standards](#code-quality-standards)
4. [Cleanup System Guidelines](#cleanup-system-guidelines)
5. [Testing Requirements](#testing-requirements)
6. [Documentation Standards](#documentation-standards)

## Getting Started

### Prerequisites

- Node.js 18+ with pnpm package manager
- PostgreSQL database
- Git with clean working directory
- Access to development environment

### Initial Setup

```bash
# Clone repository
git clone [repository-url]
cd cidery-management-app

# Install dependencies
pnpm install

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Set up database
pnpm db:migrate
pnpm db:seed

# Verify setup
pnpm build
pnpm test
```

## Development Workflow

### Branch Strategy

- **main**: Production-ready code
- **develop**: Integration branch for features
- **feature/[name]**: Individual feature development
- **epic/[name]**: Epic-level development branches

### Pull Request Process

1. **Create Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Pre-Development Cleanup**
   ```bash
   # Run analysis to understand current state
   pnpm analysis:all

   # Clean up any existing issues first
   pnpm cleanup:code --dry-run
   pnpm cleanup:deps --dry-run
   ```

3. **Development**
   - Follow code quality standards
   - Write tests for new functionality
   - Update documentation as needed
   - Run continuous validation

4. **Pre-Commit Validation**
   ```bash
   # Automated cleanup
   pnpm cleanup:auto

   # Quality checks
   pnpm lint
   pnpm typecheck
   pnpm test
   pnpm build
   ```

5. **Create Pull Request**
   - Automated CI checks will run
   - Address any quality gate failures
   - Respond to automated PR comments

## Code Quality Standards

### TypeScript Standards

- **Strict Type Checking**: All code must pass strict TypeScript checks
- **No `any` Types**: Use proper type definitions
- **Interface Consistency**: Follow established interface patterns
- **Export Management**: Remove unused exports regularly

### Code Organization

- **File Structure**: Follow established monorepo patterns
- **Import Paths**: Use barrel imports where appropriate
- **Naming Conventions**: Follow existing patterns
- **Dead Code**: Remove unused code promptly

### Performance Standards

- **Bundle Size**: Keep additions under quality gate thresholds
- **Build Time**: Maintain or improve build performance
- **Runtime Performance**: Profile changes for performance impact
- **Memory Usage**: Monitor memory consumption

## Cleanup System Guidelines

### Understanding Quality Gates

The CI system enforces these thresholds:

```yaml
MAX_BUNDLE_SIZE_KB: 1000      # Bundle size limit
MAX_BUILD_TIME_SECONDS: 120   # Build time limit
MAX_DEAD_CODE_FILES: 5        # Dead code tolerance
MAX_UNUSED_DEPS: 3            # Unused dependency limit
MAX_CIRCULAR_DEPS: 0          # Circular dependency limit
```

### Pre-Development Cleanup

Before starting new development:

```bash
# 1. Analyze current state
pnpm analysis:all

# 2. Review findings
cat analysis/reports/baseline/analysis-report.md

# 3. Clean up existing issues
pnpm cleanup:code --dry-run    # Review before applying
pnpm cleanup:deps --dry-run    # Review before applying
pnpm cleanup:assets --dry-run  # Review before applying

# 4. Apply safe cleanups
pnpm cleanup:auto
```

### During Development

Maintain code quality throughout development:

```bash
# Regular quality checks
pnpm lint
pnpm typecheck
pnpm test

# Performance monitoring
pnpm analysis:bundle

# Dead code detection
pnpm analysis:dead-code
```

### Pre-Commit Cleanup

Before committing changes:

```bash
# 1. Final cleanup pass
pnpm cleanup:auto

# 2. Validate all systems
pnpm build
pnpm test

# 3. Check performance impact
pnpm analysis:bundle

# 4. Verify no quality gate violations
pnpm analysis:quality-gates
```

### Cleanup Categories

#### Code Cleanup
- **Unused Exports**: Remove exports not used by other modules
- **Dead Code**: Remove unreachable or unused code paths
- **Orphaned Files**: Remove files no longer referenced
- **Import Optimization**: Clean up unused imports

**Commands:**
```bash
pnpm analysis:dead-code    # Detect dead code
pnpm cleanup:code         # Remove dead code
```

#### Asset Cleanup
- **Duplicate Assets**: Consolidate duplicate images/files
- **Unused Assets**: Remove unreferenced assets
- **Asset Optimization**: Optimize file sizes

**Commands:**
```bash
pnpm analysis:assets       # Analyze assets
pnpm cleanup:assets        # Clean up assets
```

#### Dependency Cleanup
- **Unused Dependencies**: Remove unused packages
- **Dependency Deduplication**: Optimize package versions
- **Security Updates**: Update vulnerable packages

**Commands:**
```bash
pnpm analysis:deps         # Analyze dependencies
pnpm cleanup:deps          # Clean up dependencies
```

#### Database Cleanup
- **Schema Optimization**: Deprecate unused tables/columns
- **Index Optimization**: Remove unused indexes
- **Data Integrity**: Maintain referential integrity

**Commands:**
```bash
pnpm analysis:database     # Analyze database
pnpm db:deprecate          # Mark elements for deprecation
```

### Quality Gate Failures

If CI quality gates fail:

1. **Review Failure Details**
   - Check PR comments for specific issues
   - Review CI logs for detailed information
   - Analyze quality gate thresholds

2. **Address Issues**
   ```bash
   # For bundle size issues
   pnpm analysis:bundle
   pnpm cleanup:assets

   # For dead code issues
   pnpm analysis:dead-code
   pnpm cleanup:code

   # For dependency issues
   pnpm analysis:deps
   pnpm cleanup:deps
   ```

3. **Validate Fixes**
   ```bash
   pnpm build
   pnpm test
   pnpm analysis:quality-gates
   ```

### Rollback Procedures

If cleanup causes issues:

1. **Immediate Assessment**
   ```bash
   git status
   pnpm build
   pnpm test
   ```

2. **Selective Rollback**
   ```bash
   # Restore specific files
   git checkout HEAD~1 -- path/to/file

   # Restore dependencies
   git checkout HEAD~1 -- package.json
   pnpm install
   ```

3. **Full Rollback if Needed**
   ```bash
   git reset --hard HEAD~1
   pnpm install
   ```

See [rollback-procedures.md](./docs/cleanup-system/rollback-procedures.md) for detailed rollback information.

## Testing Requirements

### Test Coverage

- **New Features**: 90%+ test coverage required
- **Bug Fixes**: Include regression tests
- **Cleanup Operations**: Test before and after states
- **Integration Tests**: Cover major workflows

### Test Categories

```bash
# Unit tests
pnpm test:unit

# Integration tests
pnpm test:integration

# End-to-end tests
pnpm test:e2e

# Database tests
pnpm db:test

# Cleanup validation tests
pnpm test:cleanup
```

### Performance Testing

```bash
# Baseline measurement
pnpm analysis:performance

# Load testing
pnpm test:load

# Memory testing
pnpm test:memory
```

## Documentation Standards

### Code Documentation

- **JSDoc Comments**: Document public APIs
- **Type Definitions**: Comprehensive type documentation
- **README Updates**: Keep README files current
- **API Documentation**: Document API changes

### Process Documentation

- **Change Documentation**: Document significant changes
- **Migration Guides**: Provide upgrade instructions
- **Troubleshooting**: Document common issues
- **Examples**: Provide usage examples

## Maintenance Responsibilities

### Regular Maintenance (Weekly)

```bash
# Dependency updates
pnpm update

# Cleanup operations
pnpm cleanup:auto

# Performance monitoring
pnpm analysis:performance

# Documentation updates
# Update relevant documentation
```

### Monthly Maintenance

```bash
# Full system analysis
pnpm analysis:comprehensive

# Database maintenance
pnpm db:maintenance

# Security audits
pnpm audit

# Performance benchmarking
pnpm benchmark:full
```

### Quarterly Maintenance

- Major dependency updates
- Performance optimization
- Documentation review
- Training material updates
- System architecture review

## Best Practices

### Development Best Practices

1. **Start Clean**: Run cleanup before development
2. **Incremental Changes**: Make small, focused commits
3. **Continuous Testing**: Test throughout development
4. **Performance Awareness**: Monitor performance impact
5. **Documentation**: Keep documentation current

### Cleanup Best Practices

1. **Safety First**: Always use dry-run mode first
2. **Incremental Cleanup**: Apply changes gradually
3. **Validation**: Verify each cleanup operation
4. **Backup**: Ensure backups before major changes
5. **Communication**: Coordinate cleanup with team

### Quality Assurance

1. **Automated Checks**: Leverage CI quality gates
2. **Manual Review**: Review automated findings
3. **Performance Testing**: Validate performance impact
4. **Security**: Run security scans regularly
5. **Documentation**: Keep all docs updated

## Troubleshooting

### Common Issues

1. **Build Failures**: Often caused by missing dependencies or imports
2. **Test Failures**: Usually due to removed code or changed interfaces
3. **Performance Regressions**: May result from inefficient cleanup
4. **Quality Gate Failures**: Address specific threshold violations

### Getting Help

1. **Documentation**: Check [troubleshooting.md](./docs/cleanup-system/troubleshooting.md)
2. **Team Discussion**: Use established communication channels
3. **Issue Tracking**: Create issues for reproducible problems
4. **Emergency Procedures**: Follow escalation matrix for critical issues

## Emergency Contacts

- **Development Team Lead**: [Contact Information]
- **System Administrator**: [Contact Information]
- **Database Administrator**: [Contact Information]
- **DevOps Engineer**: [Contact Information]

## Resources

- [Operation Guide](./docs/cleanup-system/operation-guide.md)
- [Rollback Procedures](./docs/cleanup-system/rollback-procedures.md)
- [Troubleshooting Guide](./docs/cleanup-system/troubleshooting.md)
- [Training Materials](./docs/cleanup-system/team-training.md)
- [Tool Configuration](./docs/cleanup-system/tool-configuration.md)

---

**Remember**: Good code hygiene is everyone's responsibility. Regular cleanup and maintenance keep the codebase healthy and the team productive.