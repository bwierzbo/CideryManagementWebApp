---
name: cleanupandcodechecks
status: backlog
created: 2025-09-28T20:34:05Z
progress: 0%
prd: .claude/prds/cleanupandcodechecks.md
github: https://github.com/bwierzbo/CideryManagementWebApp/issues/87
---

# Epic: cleanupandcodechecks

## Overview

Implement a comprehensive, automated codebase cleanup system with zero functional changes. This epic focuses on building analysis tools, cleanup automation, and safety mechanisms to remove technical debt while maintaining strict guardrails. The solution leverages existing tools (knip, ts-prune, depcheck) with custom scripts for database analysis and asset optimization.

## Architecture Decisions

- **Tool-based approach**: Leverage existing open-source tools rather than building custom analyzers
- **Report-first strategy**: Generate comprehensive reports before any changes to ensure safety
- **Staged execution**: Separate analysis, code cleanup, dependency cleanup, and database phases
- **Non-destructive Phase 1**: Database deprecation without drops, followed by optional removal phase
- **CI-first safety**: Integrate checks into CI pipeline to prevent future debt accumulation
- **Monorepo-aware**: Support for pnpm workspace structure with package-specific analysis

## Technical Approach

### Analysis Engine
**Core Tools Integration**:
- `knip`: Dead code detection across TypeScript/Next.js/tRPC
- `ts-prune`: TypeScript unused exports analysis
- `depcheck`: Dependency usage analysis
- `madge`: Circular dependency and orphan detection
- Custom scripts: Asset usage scanning, database schema analysis

**Reporting System**:
- JSON output from each tool for programmatic processing
- Consolidated markdown reports for human review
- Risk assessment and confidence scoring
- Rollback instructions for each proposed change

### Cleanup Automation
**Code Cleanup**:
- Automated unused export removal with import path updates
- Duplicate file detection via content hashing (xxhash/sha1)
- Safe file deletion with git history preservation
- Import path normalization and barrel file optimization

**Dependency Management**:
- Unused dependency removal with lockfile regeneration
- Missing peerDependency detection and addition
- Version drift analysis and consolidation recommendations

**Asset Optimization**:
- Public asset usage scanning via import/CSS/Next.js analysis
- Duplicate image detection and consolidation
- Format optimization suggestions (webp/avif)

### Database Safety System
**Analysis Phase**:
- Drizzle schema introspection and code usage correlation
- AST parsing + grep fallback for table/column references
- Migration history analysis to avoid breaking seed/migration logic

**Non-Destructive Phase 1**:
- Rename tables to `${name}_deprecated_YYYYMMDD`
- Create views with original names for read compatibility
- Optional logging triggers for write access monitoring

**Phase 2 (Conditional)**:
- Telemetry-based removal decision (14-day soak period)
- Automated backup verification before drops
- Rollback migration generation

### Infrastructure

**CI/CD Integration**:
- GitHub Actions workflow for automated analysis
- PR comment generation with cleanup reports
- Quality gates preventing merge with new technical debt
- Performance benchmarking (build time, bundle size)

**Safety Mechanisms**:
- Commit fencing by cleanup category
- Automated test execution between phases
- Rollback script generation
- Production monitoring integration

## Implementation Strategy

### Development Phases

**Phase 1: Foundation & Code Cleanup** (1 sprint)
- Install and configure analysis tools
- Build custom asset and database scanners
- Create reporting infrastructure
- Execute code and dependency cleanup
- Integrate with CI pipeline

**Phase 2: Database Deprecation** (1 sprint)
- Deploy database usage analysis
- Generate Phase 1 deprecation migrations
- Implement monitoring and telemetry
- Stage for production deployment

**Phase 3: Database Removal** (1 sprint)
- Analyze telemetry data from soak period
- Execute Phase 2 removal migrations if safe
- Document final cleanup results
- Establish ongoing maintenance procedures

### Risk Mitigation

- **False positive protection**: Require 2+ tools to confirm unused status
- **Dynamic import safety**: Pattern-based scanning for runtime imports
- **Next.js awareness**: Special handling for route groups, dynamic routes, layouts
- **Test isolation**: Separate test environment for migration validation
- **Incremental rollout**: Category-based cleanup with individual rollback plans

### Testing Approach

- **Static analysis validation**: Verify tool outputs against known test cases
- **Integration testing**: Full monorepo analysis and cleanup simulation
- **Migration testing**: Database schema changes in isolated environment
- **Performance benchmarking**: Before/after metrics for build and runtime performance
- **Rollback testing**: Verify all changes can be safely reverted

## Task Breakdown Preview

High-level task categories that will be created:
- [ ] **Analysis Infrastructure**: Install tools, create custom scanners, build reporting system
- [ ] **Code & Asset Cleanup**: Remove unused code/assets, deduplicate files, normalize imports
- [ ] **Dependency Management**: Prune unused deps, fix missing peers, regenerate lockfiles
- [ ] **Database Analysis**: Build schema-to-code mapping, identify unused elements
- [ ] **Database Safety System**: Create non-destructive migrations, implement monitoring
- [ ] **CI Integration**: Add cleanup checks to pipeline, performance benchmarking
- [ ] **Documentation & Rollback**: Create cleanup guides, rollback procedures, maintenance docs
- [ ] **Validation & Testing**: Comprehensive testing across all cleanup categories

## Dependencies

### External Service Dependencies
- **PostgreSQL**: Database introspection and migration testing
- **GitHub Actions**: CI/CD pipeline integration
- **npm registry**: Tool installation and updates

### Internal Team Dependencies
- **Engineering Team**: Code review capacity, pattern knowledge, test validation
- **DevOps Team**: CI configuration, database backup procedures, monitoring setup
- **Product Team**: Timeline approval, risk acceptance, feature freeze coordination

### Prerequisite Work
- Current test suite must be comprehensive and passing
- Database backup procedures must be verified and tested
- Team alignment on code formatting standards (ESLint/Prettier rules)

## Success Criteria (Technical)

### Performance Benchmarks
- **Build Time**: 25% reduction (target: from current baseline)
- **Bundle Size**: 20% reduction (Next.js production build)
- **Type Check Time**: 30% reduction (tsc --noEmit execution)
- **Dev Server Start**: 15% reduction (Next.js dev startup)

### Quality Gates
- **Zero unused exports**: Confirmed by knip + ts-prune
- **Zero duplicate files**: Verified by content hash analysis
- **Zero unused dependencies**: Validated by depcheck
- **Zero circular dependencies**: Confirmed by madge
- **100% lint compliance**: ESLint + Prettier passing
- **TypeScript strict mode**: All packages using strict: true

### Acceptance Criteria
- All existing tests continue to pass
- No runtime errors in development or production
- Database queries show no performance regression
- CI pipeline runs cleanup checks automatically
- Rollback procedures documented and tested
- Team reports improved developer experience

## Estimated Effort

### Overall Timeline
- **3 sprints total**: 6 weeks end-to-end
- **Sprint 1**: Analysis tools + code cleanup (2 weeks)
- **Sprint 2**: Database deprecation + CI integration (2 weeks)
- **Sprint 3**: Database removal + documentation (2 weeks)

### Resource Requirements
- **1 senior developer**: Full-time implementation
- **2 code reviewers**: Part-time review and validation
- **1 DevOps engineer**: CI configuration and monitoring (0.5 sprint)
- **Product owner**: Risk approval and timeline coordination (0.25 sprint)

### Critical Path Items
1. **Tool integration and configuration** (Sprint 1, Week 1)
2. **Database schema analysis accuracy** (Sprint 2, Week 1)
3. **CI pipeline integration** (Sprint 1, Week 2)
4. **Production deployment coordination** (Sprint 2, Week 2)
5. **Telemetry analysis and decision** (Sprint 3, Week 1-2)

### Risk Factors
- **Complex codebase analysis**: May require tool configuration tuning
- **Database schema complexity**: Unknown depth of unused elements
- **Team coordination**: Requires synchronized deployment and testing
- **Rollback complexity**: Must be thoroughly tested before production

## Tasks Created
- [ ] #89 - Setup Analysis Infrastructure (parallel: false)
- [ ] #93 - Code & Asset Cleanup (parallel: false)
- [ ] #95 - Dependency Management (parallel: true)
- [ ] #88 - Database Analysis - Schema-to-code mapping and usage scanning (parallel: true)
- [ ] #91 - Database Safety System - Non-destructive migrations and monitoring (parallel: false)
- [ ] #94 - CI Integration - Automated cleanup checks and quality gates (parallel: true)
- [ ] #90 - Validation & Testing - Comprehensive testing of all cleanup categories (parallel: false)
- [ ] #92 - Documentation & Rollback - Create comprehensive cleanup guides and rollback procedures (parallel: false)

Total tasks: 8
Parallel tasks: 3
Sequential tasks: 5
Estimated total effort: 3 sprints (6 weeks)
